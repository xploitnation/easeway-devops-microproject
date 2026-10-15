# VPC definition
resource "aws_vpc" "easeway_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name    = "easeway-vpc"
    Project = "Easeway-DevSecOps"
  }
}

# Internet Gateway for public internet access
resource "aws_internet_gateway" "easeway_igw" {
  vpc_id = aws_vpc.easeway_vpc.id

  tags = {
    Name    = "easeway-igw"
    Project = "Easeway-DevSecOps"
  }
}

# Public Subnet
resource "aws_subnet" "public_subnet" {
  vpc_id                  = aws_vpc.easeway_vpc.id
  cidr_block              = var.public_subnet_cidr
  map_public_ip_on_launch = true
  availability_zone       = "${var.aws_region}a"

  tags = {
    Name    = "easeway-public-subnet"
    Project = "Easeway-DevSecOps"
  }
}

# Route Table for Internet-bound traffic
resource "aws_route_table" "public_rt" {
  vpc_id = aws_vpc.easeway_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.easeway_igw.id
  }

  tags = {
    Name    = "easeway-public-rt"
    Project = "Easeway-DevSecOps"
  }
}

# Associate Route Table with Public Subnet
resource "aws_route_table_association" "public_rta" {
  subnet_id      = aws_subnet.public_subnet.id
  route_table_id = aws_route_table.public_rt.id
}
