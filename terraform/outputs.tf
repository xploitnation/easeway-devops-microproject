output "instance_id" {
  description = "ID of the deployed EC2 instance"
  value       = aws_instance.easeway_instance.id
}

output "instance_public_ip" {
  description = "Public IP address of the deployed EC2 instance"
  value       = aws_instance.easeway_instance.public_ip
}

output "instance_public_dns" {
  description = "Public DNS name of the EC2 instance"
  value       = aws_instance.easeway_instance.public_dns
}

output "ssh_command" {
  description = "Convenience SSH command to connect to the instance"
  value       = "ssh -i ~/.ssh/${var.key_name}.pem ubuntu@${aws_instance.easeway_instance.public_ip}"
}

output "easeway_app_url" {
  description = "Direct access URL for Easeway platform"
  value       = "http://${aws_instance.easeway_instance.public_ip}:3000"
}

output "jenkins_url" {
  description = "Jenkins CI/CD automation server URL"
  value       = "http://${aws_instance.easeway_instance.public_ip}:8080"
}

output "sonarqube_url" {
  description = "SonarQube dashboard URL"
  value       = "http://${aws_instance.easeway_instance.public_ip}:9000"
}
