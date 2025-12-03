# Deploy na AWS - Análise Completa

## 🤔 AWS vs Render

### ✅ Vantagens da AWS

1. **Você já tem tudo configurado**
   - Credenciais ativas
   - S3 buckets existentes
   - Conta pronta

2. **Escalabilidade**
   - Escala quase ilimitada
   - Auto-scaling avançado
   - Múltiplas regiões

3. **Serviços Gerenciados**
   - RDS PostgreSQL (melhor que Render)
   - ElastiCache Redis
   - S3 (já tem)
   - CloudWatch (monitoring)

4. **Custo em Escala**
   - Pode ser mais barato em grande escala
   - Pay-as-you-go
   - Reserved instances (desconto)

5. **Integração**
   - Tudo na mesma conta
   - Faturamento unificado
   - IAM integrado

### ❌ Desvantagens da AWS

1. **Complexidade**
   - VPC, Security Groups, IAM
   - Múltiplos serviços para configurar
   - Curva de aprendizado

2. **Tempo de Setup**
   - Mais tempo para configurar
   - Precisa entender AWS
   - Mais coisas para gerenciar

3. **Custo Inicial**
   - Pode ser mais caro no início
   - Muitos serviços = mais custos
   - Difícil prever custos

## 📊 Comparação de Custos

### Render (Previsível)

| Serviço | Starter | Standard |
|---------|---------|----------|
| Web Service | $7/mês | $25/mês |
| Worker | $7/mês | $25/mês |
| PostgreSQL | $7/mês | $25/mês |
| Redis | $7/mês | $7/mês |
| **Total** | **$21-28/mês** | **$75-82/mês** |

### AWS (Variável)

| Serviço | Configuração | Custo Estimado |
|---------|-------------|----------------|
| **App Runner** (simples) | 1 vCPU, 2GB RAM | ~$30-50/mês |
| **ECS Fargate** | 0.5 vCPU, 1GB RAM | ~$20-40/mês |
| **RDS PostgreSQL** | db.t3.micro | ~$15/mês |
| **ElastiCache Redis** | cache.t3.micro | ~$15/mês |
| **S3** | Storage + requests | ~$1-5/mês |
| **ALB** (Load Balancer) | Application LB | ~$16/mês |
| **Data Transfer** | Outbound | ~$5-10/mês |
| **CloudWatch** | Logs + metrics | ~$5/mês |
| **Total** | | **~$87-142/mês** |

**Nota:** AWS pode ser mais barato em escala, mas mais caro no início.

## 🏗️ Opções de Deploy na AWS

### Opção 1: AWS App Runner (Mais Simples) ⭐ Recomendado

**Similar ao Render, mas na AWS**

```yaml
# apprunner.yaml
version: 1.0
runtime: nodejs18
build:
  commands:
    build:
      - npm install
      - npm run build
run:
  runtime-version: 18
  command: npm start
  network:
    port: 3000
    env: PORT
  env:
    - name: NODE_ENV
      value: production
    - name: DATABASE_URL
      value: ${RDS_DATABASE_URL}
```

**Vantagens:**
- ✅ Simples como Render
- ✅ Auto-scaling
- ✅ SSL automático
- ✅ Deploy via Git

**Desvantagens:**
- ❌ WebSocket limitado (precisa ALB)
- ❌ Menos controle
- ❌ Mais caro que ECS

**Custo:** ~$30-50/mês

---

### Opção 2: ECS Fargate (Mais Controle)

**Containers gerenciados**

```yaml
# docker-compose.yml (para ECS)
version: '3.8'
services:
  antenna:
    image: your-registry/antenna:latest
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - DATABASE_URL=${DATABASE_URL}
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 1G
```

**Vantagens:**
- ✅ Controle total
- ✅ WebSocket nativo
- ✅ Auto-scaling
- ✅ Mais barato que App Runner

**Desvantagens:**
- ❌ Mais complexo
- ❌ Precisa configurar VPC, ALB
- ❌ Precisa Docker

**Custo:** ~$40-60/mês

---

### Opção 3: EC2 (Tradicional)

**Servidor dedicado**

**Vantagens:**
- ✅ Controle total
- ✅ Mais barato em escala
- ✅ WebSocket nativo

**Desvantagens:**
- ❌ Precisa gerenciar servidor
- ❌ Updates manuais
- ❌ Mais trabalho

**Custo:** ~$10-20/mês (t2.micro)

---

### Opção 4: Lambda + API Gateway (Serverless)

**Não recomendado para este projeto**

**Problemas:**
- ❌ WebSocket limitado (API Gateway v2)
- ❌ Timeout de 15 minutos
- ❌ Cold starts
- ❌ Não ideal para sempre-on

---

## 🎯 Arquitetura Recomendada na AWS

### Arquitetura Completa

```
┌─────────────────────────────────────────────────────────────┐
│                    AWS CLOUD                                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Application Load Balancer (ALB)                     │   │
│  │  - HTTP/HTTPS                                        │   │
│  │  - WebSocket upgrade                                 │   │
│  │  - SSL termination                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                    │                                         │
│                    ▼                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ECS Fargate Cluster                                 │   │
│  │  ┌─────────────────┐  ┌─────────────────┐         │   │
│  │  │  Antenna Service │  │  Worker Service │         │   │
│  │  │  (HTTP + WS)     │  │  (Background)   │         │   │
│  │  └─────────────────┘  └─────────────────┘         │   │
│  └─────────────────────────────────────────────────────┘   │
│                    │                                         │
│                    ▼                                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  RDS PostgreSQL                                       │   │
│  │  - Event Store                                        │   │
│  │  - Multi-AZ (opcional)                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ElastiCache Redis                                    │   │
│  │  - Job queue                                          │   │
│  │  - Caching                                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  S3                                                    │   │
│  │  - File storage                                       │   │
│  │  - Exports                                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Setup na AWS (Passo a Passo)

### 1. Criar RDS PostgreSQL

```bash
aws rds create-db-instance \
  --db-instance-identifier universal-ledger-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username postgres \
  --master-user-password YourPassword123! \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxx \
  --db-subnet-group-name default \
  --backup-retention-period 7
```

### 2. Criar ElastiCache Redis

```bash
aws elasticache create-cache-cluster \
  --cache-cluster-id universal-ledger-redis \
  --cache-node-type cache.t3.micro \
  --engine redis \
  --num-cache-nodes 1
```

### 3. Criar ECR Repository (para Docker)

```bash
aws ecr create-repository \
  --repository-name universal-business-ledger
```

### 4. Criar ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name universal-ledger-cluster \
  --capacity-providers FARGATE FARGATE_SPOT
```

### 5. Criar Application Load Balancer

```bash
aws elbv2 create-load-balancer \
  --name universal-ledger-alb \
  --subnets subnet-xxxxx subnet-yyyyy \
  --security-groups sg-xxxxx
```

### 6. Criar ECS Task Definition

```json
{
  "family": "universal-ledger-antenna",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "containerDefinitions": [{
    "name": "antenna",
    "image": "your-account.dkr.ecr.us-east-1.amazonaws.com/universal-business-ledger:latest",
    "portMappings": [{
      "containerPort": 3000,
      "protocol": "tcp"
    }],
    "environment": [
      {"name": "PORT", "value": "3000"},
      {"name": "NODE_ENV", "value": "production"}
    ],
    "secrets": [
      {"name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:..."},
      {"name": "OPENAI_API_KEY", "valueFrom": "arn:aws:secretsmanager:..."}
    ]
  }]
}
```

---

## 📝 Terraform (Infrastructure as Code)

Melhor usar Terraform para gerenciar tudo:

```hcl
# main.tf
provider "aws" {
  region = "us-east-1"
}

# VPC
resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

# RDS
resource "aws_db_instance" "ledger" {
  identifier     = "universal-ledger-db"
  engine         = "postgres"
  instance_class = "db.t3.micro"
  allocated_storage = 20
  # ...
}

# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "universal-ledger-cluster"
}

# ECS Service
resource "aws_ecs_service" "antenna" {
  name            = "antenna"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.antenna.arn
  desired_count   = 1
  launch_type     = "FARGATE"
  # ...
}
```

---

## 💰 Estimativa de Custos Detalhada

### Setup Inicial (Mensal)

| Serviço | Config | Custo |
|---------|--------|-------|
| ECS Fargate (Antenna) | 0.5 vCPU, 1GB | ~$15/mês |
| ECS Fargate (Worker) | 0.25 vCPU, 512MB | ~$8/mês |
| RDS PostgreSQL | db.t3.micro | ~$15/mês |
| ElastiCache Redis | cache.t3.micro | ~$15/mês |
| ALB | Application LB | ~$16/mês |
| S3 | Storage + requests | ~$2/mês |
| CloudWatch | Logs + metrics | ~$5/mês |
| Data Transfer | Outbound | ~$5/mês |
| **Total** | | **~$81/mês** |

### Comparação

| Plataforma | Custo Mensal | Complexidade |
|------------|--------------|--------------|
| **Render** | $21-82/mês | ⭐ Simples |
| **AWS App Runner** | $30-50/mês | ⭐⭐ Médio |
| **AWS ECS Fargate** | $81/mês | ⭐⭐⭐ Complexo |
| **AWS EC2** | $20-40/mês | ⭐⭐⭐⭐ Muito complexo |

---

## 🎯 Recomendação Final

### Use AWS se:
- ✅ Você já tem experiência com AWS
- ✅ Precisa de controle total
- ✅ Vai escalar muito
- ✅ Quer tudo na mesma conta
- ✅ Tem tempo para configurar

### Use Render se:
- ✅ Quer simplicidade
- ✅ Quer deploy rápido
- ✅ Não quer gerenciar infraestrutura
- ✅ Custo previsível
- ✅ Foco no desenvolvimento

---

## 🚀 Próximos Passos

Se escolher AWS:

1. **Opção Rápida:** AWS App Runner (similar ao Render)
2. **Opção Completa:** ECS Fargate + RDS + ElastiCache
3. **Opção Econômica:** EC2 (mais trabalho)

Quer que eu crie os arquivos de configuração para AWS?

