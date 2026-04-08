---
slug: refactoring-terraform-into-modules
title: Refactoring Terraform into Modules Safely
authors: [rayen-dhmaied]
tags: [terraform, iac, aws]
---

I was working on an older Terraform project that managed a full EKS stack: VPC, cluster, node groups, and around ten Kubernetes add-ons. Everything lived in a single `main.tf` file that had grown to over a thousand lines. It worked, but it was really hard to navigate. Anytime I needed to make a change or add something new, I'd spend more time figuring out where things were than actually getting the work done.

```bash
.
├── main.tf      # 1000+ lines: VPC, EKS, add-ons, storage all in one file
├── variables.tf
├── outputs.tf
├── providers.tf
├── backend.tf
└── vars.tfvars
```

It was obvious that I had to break things into modules. But how to do it without accidentally destroying anything is what I'm going to talk about.

<!-- truncate -->

## Why This Isn't Straightforward

When you move a resource into a module, its state address changes:

```
# was
aws_vpc.main

# now
module.vpc.aws_vpc.main
```

Terraform doesn't know those are the same thing. If you just refactor the code and run `apply`, it will destroy the old resource and create a new one. For a VPC with a live EKS cluster on top of it, that's a full teardown.

The fix is `terraform state mv`. It renames the address of a resource in the state file without touching the actual infrastructure. The whole approach is:

1. Write the module
2. Move the state addresses
3. Run `plan` and verify zero changes before doing anything else

## Deciding What Becomes a Module

Three questions to ask before you start:

**Does it have a single concern?** Resources like `aws_vpc`, `aws_subnet`, and `aws_nat_gateway` are all part of networking, so they belong together.

**Does it share a lifecycle?** `aws_eip` and `aws_nat_gateway` are always created and destroyed together.

**Where are the dependency seams?** Sketch the flow:

```hcl
module "vpc" → module "eks" → module "addons"
#  vpc_id          subnet_ids      cluster_name
#  subnet_ids      oidc_arn        oidc_arn
```

Each arrow represents a dependency, an output on one side and a variable on the other. If two groups of resources reference each other in both directions, they belong in the same module.

## Audit the State First

Before writing a single module, run:

```bash
terraform state list
```

Every line is an address you'll need to remap. Build a mapping table, old address on the left, new module address on the right.

For a VPC module, it looks like:

| Old                           | New                                      |
| ----------------------------- | ---------------------------------------- |
| `aws_vpc.main`                | `module.vpc.aws_vpc.main`                |
| `aws_internet_gateway.igw[0]` | `module.vpc.aws_internet_gateway.igw[0]` |
| `aws_eip.eip[0]`              | `module.vpc.aws_eip.eip[0]`              |
| `aws_nat_gateway.nat[0]`      | `module.vpc.aws_nat_gateway.nat[0]`      |
| `aws_subnet.private[0]`       | `module.vpc.aws_subnet.private[0]`       |
| `aws_subnet.private[1]`       | `module.vpc.aws_subnet.private[1]`       |
| `aws_subnet.private[2]`       | `module.vpc.aws_subnet.private[2]`       |
| `aws_subnet.public[0]`        | `module.vpc.aws_subnet.public[0]`        |
| `aws_subnet.public[1]`        | `module.vpc.aws_subnet.public[1]`        |
| `aws_subnet.public[2]`        | `module.vpc.aws_subnet.public[2]`        |

Data sources (`data.*`) don't have persistent state and are re-evaluated on every plan. If they're shared across modules, keep them in the root `main.tf` and pass their values in as variables. Otherwise, move them into the module where they're used.

## Writing the Module

**IMPORTANT:** Start with one module. If it's successfully applied, move to the next one.

Each module gets three files: `variables.tf`, `main.tf`, and `outputs.tf`.

The resources in the module `main.tf` should be an **exact copy** of what's in your root `main.tf`. Don't rename or refactor anything. Other improvements should come after the new module is applied.

The VPC module is shown in full below. The other modules (`eks`, `addons`, `storage`) follow the exact same pattern, only the resources and variable names differ.

```hcl
# modules/vpc/variables.tf

variable "region"   { type = string }
variable "env"      { type = string }
variable "eks_name" { type = string }

variable "vpc_cidr_block"        { type = string }
variable "private_subnets"       { type = list(string) }
variable "public_subnets"        { type = list(string) }
variable "enable_nat_gateway"    { type = bool; default = true }
variable "enable_dns_support"    { type = bool; default = true }
variable "enable_dns_hostnames"  { type = bool; default = true }
```

```hcl
# modules/vpc/main.tf

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr_block
  enable_dns_support   = var.enable_dns_support
  enable_dns_hostnames = var.enable_dns_hostnames

  tags = {
    Name = "${var.region}-${var.env}-${var.eks_name}-vpc"
  }
}

resource "aws_internet_gateway" "igw" {
  count  = 1
  vpc_id = aws_vpc.main.id

  tags = { Name = "${var.env}-${var.eks_name}-igw" }
}

resource "aws_eip" "eip" {
  count  = var.enable_nat_gateway ? 1 : 0
  domain = "vpc"
}

resource "aws_nat_gateway" "nat" {
  count         = var.enable_nat_gateway ? 1 : 0
  allocation_id = aws_eip.eip[0].id
  subnet_id     = aws_subnet.public[0].id

  depends_on = [aws_internet_gateway.igw[0]]
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnets)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnets[count.index]
  availability_zone = "${var.region}${["a", "b", "c"][count.index]}"

  tags = { Name = "${var.env}-${var.eks_name}-private-${count.index}" }
}

resource "aws_subnet" "public" {
  count             = length(var.public_subnets)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnets[count.index]
  availability_zone = "${var.region}${["a", "b", "c"][count.index]}"

  tags = { Name = "${var.env}-${var.eks_name}-public-${count.index}" }
}
```

```hcl
# modules/vpc/outputs.tf

output "vpc_id" {
  value = aws_vpc.main.id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "all_subnet_ids" {
  value = concat(
    aws_subnet.private[*].id,
    aws_subnet.public[*].id
  )
}
```

## Provider Declarations in Modules

This catches people off guard. If your module uses a provider that isn't from HashiCorp (`hashicorp/<provider_name>`), for example `gavinbunney/kubectl`, you have to declare it explicitly in the module's `providers.tf`. Otherwise, Terraform can't find it during init.

```hcl
# modules/addons/providers.tf

terraform {
  required_providers {
    kubectl = {
      source  = "gavinbunney/kubectl"
      version = "~> 1.19.0"
    }
  }
}
```

You don't configure the provider inside the module (no region, no credentials). That stays in the root. The module just declares what it needs, and then you pass it from the root `main.tf`. Only declare providers in the module that are not under the `hashicorp` namespace.

## Updating the Root

Replace the flat resource blocks with a module call and update any references that pointed to the moved resources:

```hcl
# main.tf

module "vpc" {
  source = "./modules/vpc"

  region             = var.region
  env                = var.env
  eks_name           = var.eks_name
  vpc_cidr_block     = var.vpc_cidr_block
  private_subnets    = var.private_subnets
  public_subnets     = var.public_subnets
  enable_nat_gateway = var.enable_nat_gateway
}

module "eks" {
  source = "./modules/eks"

  # outputs from vpc flow directly into eks inputs
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.all_subnet_ids
  # ...
}

module "addons" {
  source = "./modules/addons"

  providers = {
    kubectl = kubectl
  }

  cluster_name      = module.eks.cluster_name
  oidc_provider_arn = module.eks.oidc_provider_arn
  # ...
}
```

## Moving the State

Once the code is ready, run `terraform init` to register the new module sources, then start moving addresses:

```bash
terraform init

terraform state mv \
  aws_vpc.main \
  module.vpc.aws_vpc.main

terraform state mv \
  "aws_subnet.private[0]" \
  "module.vpc.aws_subnet.private[0]"

terraform state mv \
  'aws_nat_gateway.nat[0]' \
  'module.vpc.aws_nat_gateway.nat[0]'
```

A few things that will catch you:

**Indexed resources** keep their index in the new address.
`aws_subnet.private[0]` becomes `module.vpc.aws_subnet.private[0]`, not `module.vpc.aws_subnet.private`.

**`for_each` resources with long string keys**, like `aws_subnet` resources indexed by position, need the full key. Use quotes around the whole address to avoid shell escaping issues:

```bash
terraform state mv \
  'aws_subnet.public[0]' \
  'module.vpc.aws_subnet.public[0]'
```

For resources with dynamic keys you don't want to hardcode, like subnets created from a list, a loop works well:

```bash
for key in $(terraform state list | grep 'aws_subnet.private'); do
  suffix=$(echo "$key" | sed 's/aws_subnet.private//')
  terraform state mv \
    "aws_subnet.private${suffix}" \
    "module.vpc.aws_subnet.private${suffix}"
done
```

It's better to create a bash script to move Terraform state instead of doing it manually, to avoid errors. Make sure to put `set -e` after `#!/bin/bash` to stop script execution at the first error.

## Expected Plan Output

After all the state moves, run a plan:

```bash
terraform plan
```

It has to say:

```
No changes. Your infrastructure matches the configuration.
```

Anything else means something was missed or a reference changed value between the flat and module versions. The most common cause is an output that resolves slightly differently. Check the plan diff carefully, find the resource that's showing a change, and trace back which input changed.

Don't apply until the plan is clean. Once it is, you're done, the refactor is complete and nothing was recreated.

The Terraform project structure looked like this after applying all modules.

```bash
.
├── main.tf          # only module calls
├── variables.tf
├── outputs.tf
├── providers.tf
├── backend.tf
└── modules/
    ├── vpc/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    ├── eks/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    └── addons/
        ├── main.tf
        ├── variables.tf
        ├── outputs.tf
        └── providers.tf
```