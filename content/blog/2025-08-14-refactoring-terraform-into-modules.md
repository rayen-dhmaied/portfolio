---
slug: refactoring-terraform-into-modules
title: Refactoring Terraform into Modules Safely
authors: [rayen-dhmaied]
tags: [terraform, iac, aws]
---

At CraftSchoolship, I refactored an older Terraform project that managed our Amazon EKS (managed Kubernetes) stack: the VPC, the cluster and its node groups, storage, and around ten Kubernetes add-ons. All of it lived in one `main.tf` file of more than a thousand lines.

The code worked, but it was hard to change. Adding one add-on meant scrolling through networking, IAM, EKS, and Helm resources to find the right place.

```bash
.
├── main.tf      # 1000+ lines: VPC, EKS, add-ons, storage
├── variables.tf
├── outputs.tf
├── providers.tf
├── backend.tf
└── vars.tfvars
```

I wanted to split it into modules without Terraform recreating the live VPC the EKS cluster was attached to. Terraform's state file records each real resource under its address in the code. Moving a resource into a module changes that address, and Terraform treats a changed address as one resource to destroy and a new one to create.

I moved one module at a time. For each module I copied the resource blocks over, moved their state entries to the new addresses with `terraform state mv`, and ran `terraform plan`. Every move ended with a plan showing no changes, meaning Terraform had nothing to create or destroy in AWS. The root `main.tf` ended up holding only module calls, and the modules now stand up a production-ready EKS cluster in under 15 minutes in each of our three AWS regions.

{/* truncate */}
---

## The Risk

The VPC's state address before and after the move:

```hcl
# before
aws_vpc.main

# after
module.vpc.aws_vpc.main
```

Both addresses refer to the same VPC, but Terraform does not know that unless you tell it. After a plain move, Terraform plans a destroy for the old address (state, no code) and a create for the new one (code, no state). For the VPC, applying that plan deletes and recreates the network the EKS cluster runs in.

`terraform state mv` renames an address in state without touching the real resource. The process for each module:

1. Copy resources into a module.
2. Add the module call in the root.
3. Move each old state address to its new module address.
4. Run `terraform plan`.
5. Continue only when the plan says no changes.

---

## Pick Module Boundaries

**Group resources by concern and lifecycle.** VPC resources belong together: `aws_vpc`, subnets, route tables, internet gateway, NAT gateway, and EIPs. NAT gateways and their EIPs are usually created and removed together, so they stay in the same module.

**Make dependencies point one way.** Sketch the module flow:

```hcl
module "vpc" -> module "eks" -> module "addons"
#  vpc_id        subnet_ids      cluster_name
#  subnet_ids    oidc_arn        oidc_arn
```

Each arrow should map to an output on the left and an input on the right. If two groups need values from each other, they probably belong in the same module.

For this stack, I split the code into:

- `vpc`: networking resources
- `eks`: cluster, node groups, OIDC, cluster IAM
- `addons`: controllers, monitoring add-ons, Kubernetes manifests
- `storage`: storage classes, EBS/EFS-related resources

---

## Audit State First

Before writing modules, list the current state:

```bash
terraform state list
```

Every managed resource needs a destination address. Build a mapping table before you run any `state mv`. A resource you leave out stays at its old address, and the next plan shows it as a destroy.

For the VPC module, the mapping looked like this:

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

Data sources (`data.*`) do not need state moves. Terraform reads them during planning. If several modules need the same data source, keep it in the root and pass values down as variables. If only one module uses it, put it inside that module.

---

## Write One Module

Move one module at a time. Do not move VPC, EKS, add-ons, and storage in one commit. If the plan then shows a diff, you know which module it came from.

Each module gets the same three files:

```bash
modules/vpc/
├── main.tf
├── variables.tf
└── outputs.tf
```

Copy the resource blocks exactly. Do not rename resources, change tags, clean up variables, or improve naming during the move. Each of those edits shows up in the plan as a diff, and the move should produce none. Save them for a later commit, after the state move produces a clean plan.

Example VPC module:

```hcl
# modules/vpc/variables.tf

variable "region"   { type = string }
variable "env"      { type = string }
variable "eks_name" { type = string }

variable "vpc_cidr_block"       { type = string }
variable "private_subnets"      { type = list(string) }
variable "public_subnets"       { type = list(string) }
variable "enable_nat_gateway"   { type = bool; default = true }
variable "enable_dns_support"   { type = bool; default = true }
variable "enable_dns_hostnames" { type = bool; default = true }
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

---

## Declare Non-HashiCorp Providers

Terraform assumes providers come from the `hashicorp` namespace unless you say otherwise. If a module uses a provider like `gavinbunney/kubectl`, declare it inside the module. Without that block, `terraform init` looks for `hashicorp/kubectl`, which does not exist, and fails.

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

Do not configure the provider inside the module. Keep region, credentials, cluster endpoint, and token settings in the root. The module declares what it needs, and the root passes the configured provider in. A module with its own provider block cannot use `count` or `for_each`, and Terraform cannot destroy its resources once the module call is removed.

```hcl
module "addons" {
  source = "./modules/addons"

  providers = {
    kubectl = kubectl
  }
}
```

---

## Update the Root Module

Replace the moved resource blocks with a module call. Then point references at module outputs, so `aws_vpc.main.id` becomes `module.vpc.vpc_id`.

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

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.all_subnet_ids
}

module "addons" {
  source = "./modules/addons"

  providers = {
    kubectl = kubectl
  }

  cluster_name      = module.eks.cluster_name
  oidc_provider_arn = module.eks.oidc_provider_arn
}

module "storage" {
  source = "./modules/storage"

  # cluster and network inputs omitted here
}
```

Run `terraform init` after adding module sources. Terraform will not plan until it has installed the new modules.

```bash
terraform init
```

---

## Move the State

Move every old address to its new module address.

```bash
terraform state mv \
  aws_vpc.main \
  module.vpc.aws_vpc.main

terraform state mv \
  'aws_subnet.private[0]' \
  'module.vpc.aws_subnet.private[0]'

terraform state mv \
  'aws_nat_gateway.nat[0]' \
  'module.vpc.aws_nat_gateway.nat[0]'
```

Keep indexes and keys exactly as Terraform lists them.

```hcl
aws_subnet.private[0]
module.vpc.aws_subnet.private[0]
```

For `for_each` resources with string keys, single-quote the full address so the shell leaves the brackets and double quotes alone:

```bash
terraform state mv \
  'aws_iam_role_policy_attachment.this["AmazonEKSWorkerNodePolicy"]' \
  'module.eks.aws_iam_role_policy_attachment.this["AmazonEKSWorkerNodePolicy"]'
```

For repeated resources, script the move. Add `set -e` so the script stops on the first failed move.

```bash
#!/bin/bash
set -e

for key in $(terraform state list | grep 'aws_subnet.private'); do
  suffix=$(echo "$key" | sed 's/aws_subnet.private//')
  terraform state mv \
    "aws_subnet.private${suffix}" \
    "module.vpc.aws_subnet.private${suffix}"
done
```

---

## Or Use moved Blocks

Terraform 1.1 added `moved` blocks, which record the same rename in code:

```hcl
moved {
  from = aws_vpc.main
  to   = module.vpc.aws_vpc.main
}
```

A `moved` block is part of the code, so the rename goes through review and `terraform plan` shows it as a move. It also applies in each region that runs the code, while `terraform state mv` has to be run by hand against each region's state. On a refactor like this today, I'd use `moved` blocks and keep `terraform state mv` for one-off fixes.

---

## Expect a No-Change Plan

After the state moves, run:

```bash
terraform plan
```

You want this output:

```text
No changes. Your infrastructure matches the configuration.
```

If Terraform shows changes, stop. Do not apply. Find the resource with a diff and trace the changed input back to the module call or output. The common causes are:

- A tag changed during the copy.
- A default value differs between root and module variables.
- A list order changed.
- A reference now points to a different output.
- A provider alias did not get passed into the module.

Once the plan is clean, commit the module move. Then repeat the same process for the next module.

The final structure looked like this:

```bash
.
├── main.tf          # module calls only
├── variables.tf
├── outputs.tf
├── providers.tf
├── backend.tf
├── vars.tfvars
└── modules/
    ├── vpc/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    ├── eks/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── outputs.tf
    ├── addons/
    │   ├── main.tf
    │   ├── variables.tf
    │   ├── outputs.tf
    │   └── providers.tf
    └── storage/
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
```
