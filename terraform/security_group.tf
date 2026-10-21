resource "aws_security_group" "easeway_sg" {
  name        = "easeway-devsecops-sg"
  description = "Easeway app and restricted SSH access"
  vpc_id      = aws_vpc.easeway_vpc.id

  ingress {
    description = "SSH from my IP only"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_source_cidr]
  }

  ingress {
    description = "Easeway web app"
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "easeway-devsecops-sg"
    Project = "Easeway-DevSecOps"
  }
}
