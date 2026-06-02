# RedInside YouTube worker — Oracle Cloud Always Free
# Provisions: VCN + subnet + ARM Ampere A1 VM (2 OCPU / 12 GB) + public IP.
# Idempotent. Run: terraform init && terraform apply
# Cost: $0/mo on Always Free tier (forever, until you destroy).
#
# Auth: configure these env vars before running
#   export TF_VAR_tenancy_ocid="ocid1.tenancy.oc1..xxxxx"
#   export TF_VAR_user_ocid="ocid1.user.oc1..xxxxx"
#   export TF_VAR_fingerprint="xx:xx:xx:xx"
#   export TF_VAR_private_key_path="~/.oci/api_key.pem"
#   export TF_VAR_compartment_ocid="ocid1.compartment.oc1..xxxxx"
#   export TF_VAR_ssh_public_key="$(cat ~/.ssh/id_rsa.pub)"

terraform {
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = "~> 5.0"
    }
  }
}

provider "oci" {
  region           = var.region
  tenancy_ocid     = var.tenancy_ocid
  user_ocid        = var.user_ocid
  fingerprint      = var.fingerprint
  private_key_path = var.private_key_path
}

variable "region"        { default = "us-phoenix-1" }
variable "tenancy_ocid"  {}
variable "user_ocid"     {}
variable "fingerprint"   {}
variable "private_key_path" {}
variable "compartment_ocid" {}
variable "ssh_public_key" {}

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

resource "oci_core_vcn" "vcn" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = ["10.0.0.0/16"]
  display_name   = "ris-worker-vcn"
  dns_label      = "risworker"
}
resource "oci_core_subnet" "subnet" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.vcn.id
  cidr_block     = "10.0.1.0/24"
  display_name   = "ris-worker-subnet"
  dns_label      = "subnet1"
  route_table_id = oci_core_route_table.rt.id
  security_list_ids = [oci_core_security_list.sl.id]
}
resource "oci_core_internet_gateway" "igw" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.vcn.id
  display_name   = "ris-igw"
}
resource "oci_core_route_table" "rt" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.vcn.id
  display_name   = "ris-rt"
  route_rules {
    destination       = "0.0.0.0/0"
    network_entity_id = oci_core_internet_gateway.igw.id
  }
}
resource "oci_core_security_list" "sl" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.vcn.id
  display_name   = "ris-sl"
  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    destination_port_range { min = 22; max = 22 }
  }
  egress_security_rules { protocol = "all"; destination = "0.0.0.0/0" }
}

data "oci_core_images" "ubuntu" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "22.04"
  shape                    = "VM.Standard.A1.Flex"
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

resource "oci_core_instance" "worker" {
  compartment_id      = var.compartment_ocid
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[0].name
  display_name        = "ris-yt-worker"
  shape               = "VM.Standard.A1.Flex"
  shape_config {
    ocpus         = 2
    memory_in_gbs = 12
  }
  metadata = {
    ssh_authorized_keys = var.ssh_public_key
    user_data           = base64encode(file("${path.module}/cloud-init.sh"))
  }
  create_vnic_details {
    subnet_id        = oci_core_subnet.subnet.id
    display_name     = "ris-worker-vnic"
    assign_public_ip = true
  }
  source_details {
    source_type = "image"
    image_id    = data.oci_core_images.ubuntu.images[0].id
  }
}

output "public_ip" { value = oci_core_instance.worker.public_ip }
