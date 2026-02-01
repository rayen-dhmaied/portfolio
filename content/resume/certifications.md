---
sidebar_position: 5
---

# Certifications

export const Cert = ({img, title, url}) => (
  <div style={{textAlign: 'center'}}>
    <img src={img} alt={title} style={{width: 200, height: 200, objectFit: 'contain', marginBottom: '1rem'}} />
    <div><a href={url}><strong>{title}</strong></a></div>
  </div>
);

<div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', marginTop: '2rem'}}>

<Cert 
  img={require('./images/certifications/aws-cloud-architect.png').default}
  title="AWS Academy Graduate - AWS Academy Cloud Architecting"
  url="https://www.credly.com/badges/7ba2a429-8b10-4e65-a297-6382618be34c"
/>

<Cert 
  img={require('./images/certifications/gcp-cloud-architect.png').default}
  title="Google Cloud Certified Professional Cloud Architect"
  url="https://www.credly.com/badges/34ac71be-1389-4ee1-b3c3-86702f07057e"
/>

<Cert 
  img={require('./images/certifications/aws-cloud-foundations.png').default}
  title="AWS Academy Graduate - AWS Academy Cloud Foundations"
  url="https://www.credly.com/badges/40384e03-2ef3-4cc2-9cfc-4787df30a00d"
/>

<Cert 
  img={require('./images/certifications/gcp-cloud-engineer.png').default}
  title="Google Cloud Certified Associate Cloud Engineer"
  url="https://www.credly.com/badges/730b0d05-54f4-4167-81a0-9f2da284c7ee"
/>

</div>