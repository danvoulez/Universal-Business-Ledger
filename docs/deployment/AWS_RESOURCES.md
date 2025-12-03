# Recursos AWS Existentes

## 📋 Resumo

**Conta AWS:** `611572147468`  
**Usuário IAM:** `danvoulez`  
**Access Key Ativa:** `YOUR_AWS_ACCESS_KEY_ID` ✅  
**Região:** `us-east-1` (padrão, não configurada explicitamente)

---

## 🔑 Credenciais

### Access Keys

| Access Key ID | Status | Criada em |
|---------------|--------|-----------|
| `YOUR_AWS_ACCESS_KEY_ID` | ✅ **Active** | 2025-11-11 |
| `YOUR_AWS_ACCESS_KEY_ID` | ❌ Inactive | 2025-11-03 |

**Nota:** A chave ativa (`YOUR_AWS_ACCESS_KEY_ID`) corresponde à que está no `.env`.

---

## 🪣 S3 Buckets (13 buckets)

### Buckets Relacionados ao Ledger

| Bucket Name | Criado em | Uso Provável |
|-------------|-----------|--------------|
| `logline-ledger-dev` | 2025-11-11 | ✅ **Ledger principal** |
| `logline-ledger-dev-20251118230705336200000001` | 2025-11-18 | Backup/snapshot |
| `loglinestack-ledgerbucket136870b6-ksegnbkajblk` | 2025-11-16 | CDK/CloudFormation |

### Outros Buckets

| Bucket Name | Criado em | Uso |
|-------------|-----------|-----|
| `logline-dashboard-dev` | 2025-11-15 | Dashboard |
| `logline-dashboard-dev-51acc42e` | 2025-11-16 | Dashboard backup |
| `tdln-dev-archives` | 2025-11-27 | Arquivos |
| `tdln-dev-lambda-code` | 2025-11-28 | Lambda deployments |
| `tdln-service-dev-serverlessdeploymentbucket-yy6ygb5bdyfh` | 2025-11-24 | Serverless deployments |
| `tdln-terraform-state` | 2025-11-27 | Terraform state |
| `amplify-d105du4mk7k9wx-deployment` | 2025-11-14 | Amplify |
| `cdk-hnb659fds-assets-611572147468-us-east-1` | 2025-11-23 | CDK assets |
| `studio.logline.world` | 2025-11-23 | Studio site |
| `transformer.logline.world` | 2025-11-24 | Transformer site |

### Detalhes do Bucket Principal

**Bucket:** `logline-ledger-dev`
- **Região:** `us-east-1` (padrão)
- **Versionamento:** ✅ Habilitado
- **Status:** Ativo

---

## 👤 Permissões IAM

### Usuário: `danvoulez`

**Policies Anexadas (Managed Policies):**

1. ✅ **AdministratorAccess** - Acesso total (cuidado!)
2. AmazonAPIGatewayAdministrator
3. AmazonAPIGatewayPushToCloudWatchLogs
4. AdministratorAccess-Amplify
5. AmazonAppFlowFullAccess
6. AIOpsOperatorAccess
7. AIOpsAssistantPolicy
8. AIOpsConsoleAdminPolicy
9. AIOpsReadOnlyAccess
10. AlexaForBusinessGatewayExecution
11. AlexaForBusinessDeviceSetup
12. YOUR_AWS_SECRET_ACCESS_KEY
13. YOUR_AWS_SECRET_ACCESS_KEY

**⚠️ Atenção:** Você tem `AdministratorAccess`, o que significa acesso total à conta AWS.

---

## 💡 Recomendações para Universal Business Ledger

### 1. Usar Bucket Existente

Você já tem o bucket `logline-ledger-dev` que pode ser usado:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_YOUR_AWS_SECRET_ACCESS_KEY
AWS_S3_BUCKET=logline-ledger-dev
```

### 2. Criar Bucket Dedicado (Recomendado)

Para separar o Universal Business Ledger:

```bash
# Criar novo bucket
aws s3 mb s3://universal-business-ledger-dev --region us-east-1

# Habilitar versionamento
aws s3api put-bucket-versioning \
  --bucket universal-business-ledger-dev \
  --versioning-configuration Status=Enabled
```

### 3. Criar IAM User Dedicado (Melhor Prática)

Para não usar credenciais com `AdministratorAccess`:

```bash
# Criar usuário específico
aws iam create-user --user-name ubl-service

# Criar policy restrita apenas para S3
aws iam put-user-policy \
  --user-name ubl-service \
  --policy-name S3LedgerAccess \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::universal-business-ledger-dev",
        "arn:aws:s3:::universal-business-ledger-dev/*"
      ]
    }]
  }'

# Criar access key
aws iam create-access-key --user-name ubl-service
```

---

## 🔧 Configuração Atual no .env

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_YOUR_AWS_SECRET_ACCESS_KEY
```

**Status:** ✅ Credenciais válidas e ativas

---

## 📝 Próximos Passos

### Opção 1: Usar Bucket Existente
- Descomentar variáveis AWS no `.env`
- Usar `logline-ledger-dev` como bucket
- ✅ Rápido, já funciona

### Opção 2: Criar Bucket Dedicado (Recomendado)
- Criar `universal-business-ledger-dev`
- Habilitar versionamento
- Configurar CORS se necessário
- ✅ Melhor organização

### Opção 3: Criar IAM User Dedicado (Melhor Prática)
- Criar usuário `ubl-service`
- Policy restrita apenas para S3 do UBL
- Gerar novas access keys
- ✅ Mais seguro

---

## ⚠️ Segurança

1. **Não commitar credenciais** - Já está no `.gitignore` ✅
2. **Rotacionar keys** - A chave ativa tem 2+ meses
3. **Usar IAM user dedicado** - Em vez de AdministratorAccess
4. **Limitar permissões** - Apenas o necessário para S3
5. **Usar Render secrets** - Para produção, não `.env`

---

## ✅ Conclusão

Você já tem:
- ✅ Credenciais AWS válidas
- ✅ Bucket S3 existente (`logline-ledger-dev`)
- ✅ Permissões suficientes (AdministratorAccess)

**Pode usar S3 agora mesmo!** Basta descomentar as variáveis no `.env`.

