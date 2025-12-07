/**
 * OPERATOR MESSAGES - Operational UX Helpers
 * 
 * Fase 6: UX DE OPERADOR DO DIAMANTE
 * 
 * This module provides helpers for generating operator-friendly messages:
 * - Incident messages (API down, errors, etc.)
 * - Guidance messages (how to fix something)
 * - Diagnostic messages (technical analysis)
 * - Runbook templates
 * 
 * Philosophy: Messages that an operator can use at 3am, sleepy, to solve problems.
 */

import type { AgentResponse } from '../primitives';
import type { AgentMessageKind } from '../primitives';

// ============================================================================
// CONTENT HELPERS
// ============================================================================

export interface OperatorMessageContent {
  readonly markdown: string;
  readonly kind: AgentMessageKind;
  readonly suggestions: readonly string[];
}

// ============================================================================
// INCIDENT MESSAGES
// ============================================================================

export function buildApiDownMessage(context: {
  traceId?: string;
  endpoint: string;
  errorCode?: string;
  errorMessage?: string;
}): OperatorMessageContent {
  const { endpoint, traceId, errorCode, errorMessage } = context;
  
  const markdown = `⚠️ **Problema detectado na API**

- **Endpoint**: \`${endpoint}\`
- **Situação**: não está respondendo corretamente.
${traceId ? `- **Trace ID**: \`${traceId}\` (use para correlacionar logs)` : ''}
${errorCode ? `- **Código de erro**: \`${errorCode}\`` : ''}
${errorMessage ? `- **Mensagem**: ${errorMessage}` : ''}

**Sugestões de próximos passos:**

1. **Rodar o health-check completo:**
   \`\`\`bash
   ./cicd/verificar-status-aws.sh
   \`\`\`

2. **Ver logs recentes:**
   \`\`\`bash
   tail -n 200 /tmp/deploy-aws-*.log
   \`\`\`

3. **Testar endpoints específicos:**
   \`\`\`bash
   ./cicd/testar-api-endpoints.sh http://api.logline.world
   \`\`\`

4. **Ver logs da aplicação (se em EC2):**
   \`\`\`bash
   sudo journalctl -u ubl-api -n 100 | grep "${traceId || endpoint}"
   \`\`\`

Se quiser, posso te ajudar a interpretar a saída.`;

  return {
    markdown,
    kind: 'incident',
    suggestions: [
      'Rodar ./cicd/verificar-status-aws.sh',
      'Ver logs recentes do deploy',
      'Testar endpoints da API',
    ],
  };
}

export function buildAwsCredentialIssueMessage(context: {
  operation?: string;
}): OperatorMessageContent {
  const { operation = 'operação' } = context;
  
  const markdown = `🔐 **Problema com credenciais AWS**

A ${operation} falhou devido a problemas de autenticação AWS.

**Verificações:**

1. **Verificar se as credenciais estão configuradas:**
   \`\`\`bash
   aws sts get-caller-identity
   \`\`\`

2. **Verificar variáveis de ambiente:**
   \`\`\`bash
   cat .env | grep AWS
   \`\`\`

3. **Verificar se o perfil AWS está correto:**
   \`\`\`bash
   aws configure list
   \`\`\`

Se as credenciais estiverem corretas, pode ser um problema de permissões IAM.`;

  return {
    markdown,
    kind: 'incident',
    suggestions: [
      'Verificar credenciais AWS',
      'Rodar aws sts get-caller-identity',
      'Verificar variáveis de ambiente',
    ],
  };
}

export function buildDatabaseIssueMessage(context: {
  operation?: string;
  databaseUrl?: string;
}): OperatorMessageContent {
  const { operation = 'operação', databaseUrl } = context;
  
  const markdown = `🗄️ **Problema com banco de dados**

A ${operation} falhou ao acessar o banco de dados.

**Verificações:**

1. **Verificar conectividade:**
   \`\`\`bash
   psql "${databaseUrl || '$DATABASE_URL'}" -c "SELECT 1;"
   \`\`\`

2. **Verificar se o RDS está acessível:**
   \`\`\`bash
   ./cicd/verificar-status-aws.sh
   \`\`\`

3. **Ver logs de migração (se aplicável):**
   \`\`\`bash
   tail -n 100 /tmp/deploy-aws-*.log | grep -i database
   \`\`\`

4. **Verificar se o schema está atualizado:**
   \`\`\`bash
   cd Universal-Business-Ledger-Dezembro && npm run db:status
   \`\`\`

Se o problema persistir, pode ser necessário verificar as configurações de rede (security groups, VPC, etc.).`;

  return {
    markdown,
    kind: 'incident',
    suggestions: [
      'Verificar conectividade com banco',
      'Rodar ./cicd/verificar-status-aws.sh',
      'Ver logs de deploy',
    ],
  };
}

export function buildGenericErrorMessage(context: {
  error: unknown;
  operation?: string;
  traceId?: string;
}): OperatorMessageContent {
  const { error, operation = 'operação', traceId } = context;
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  const markdown = `❌ **Erro durante ${operation}**

**Mensagem de erro:**
\`\`\`
${errorMessage}
\`\`\`
${traceId ? `\n**Trace ID**: \`${traceId}\` (use para correlacionar logs)` : ''}

**Próximos passos:**

1. **Verificar logs completos:**
   \`\`\`bash
   tail -n 500 /tmp/pipeline-oficial-*.log
   \`\`\`

2. **Rodar verificação de status:**
   \`\`\`bash
   ./cicd/verificar-status-aws.sh
   \`\`\`

3. **Se for erro de API, testar endpoints:**
   \`\`\`bash
   ./cicd/testar-api-endpoints.sh http://api.logline.world
   \`\`\`

Se o problema persistir, verifique a documentação de observabilidade em \`docs/OBSERVABILITY-UBL.md\`.`;

  return {
    markdown,
    kind: 'incident',
    suggestions: [
      'Ver logs completos',
      'Rodar verificação de status',
      'Testar endpoints da API',
    ],
  };
}

// ============================================================================
// GUIDANCE MESSAGES
// ============================================================================

export function buildSessionGuidanceMessage(context: {
  reason: string;
}): OperatorMessageContent {
  const { reason } = context;
  
  const markdown = `📋 **Como usar a sessão de chat**

${reason}

**Formato correto:**

Para iniciar uma nova sessão:
\`\`\`json
{
  "message": { "text": "Olá" },
  "startSession": {
    "realmId": "realm-id",
    "actor": { "type": "User", "userId": "user-id" }
  }
}
\`\`\`

Para continuar uma sessão existente:
\`\`\`json
{
  "message": { "text": "Continuar conversa" },
  "sessionId": "sess-xyz"
}
\`\`\`

**Requisitos:**
- Você precisa fornecer **ou** \`startSession\` **ou** \`sessionId\`
- Não é possível enviar uma mensagem sem uma sessão ativa`;

  return {
    markdown,
    kind: 'guidance',
    suggestions: [
      'Iniciar nova sessão com startSession',
      'Usar sessionId de sessão existente',
    ],
  };
}

// ============================================================================
// RUNBOOK TEMPLATES
// ============================================================================

export function buildApiIncidentRunbook(context: {
  traceId?: string;
  endpoint: string;
  errorCode?: string;
}): string {
  const { endpoint, traceId, errorCode } = context;
  
  return `# Runbook: API Incident - ${endpoint}

## O que aconteceu
O endpoint \`${endpoint}\` está retornando erro${errorCode ? ` (código: ${errorCode})` : ''}.
${traceId ? `\n**Trace ID**: \`${traceId}\`` : ''}

## Onde olhar

### 1. Logs da aplicação
\`\`\`bash
sudo journalctl -u ubl-api -n 100 | grep "${traceId || endpoint}"
\`\`\`

### 2. Logs do pipeline
\`\`\`bash
tail -n 200 /tmp/pipeline-oficial-*.log
\`\`\`

### 3. Logs de deploy
\`\`\`bash
tail -n 200 /tmp/deploy-aws-*.log
\`\`\`

## Comandos para diagnosticar

### Health check completo
\`\`\`bash
./cicd/verificar-status-aws.sh
\`\`\`

### Testar todos os endpoints
\`\`\`bash
./cicd/testar-api-endpoints.sh http://api.logline.world
\`\`\`

### Verificar status do serviço (EC2)
\`\`\`bash
sudo systemctl status ubl-api
\`\`\`

## O que esperar ver

- **Se API está rodando**: status "ok" em \`/health\`
- **Se banco está acessível**: health check do event store retorna "healthy"
- **Se há erros recentes**: logs mostram stack traces ou mensagens de erro

## Próximos passos

1. Se API não está respondendo: verificar se o serviço está rodando
2. Se banco está inacessível: verificar conectividade RDS
3. Se há erros de código: verificar logs e stack traces
4. Se problema persistir: consultar \`docs/OBSERVABILITY-UBL.md\` para mais detalhes
`;
}

export function buildDeployFailureRunbook(context: {
  stage?: string;
}): string {
  const { stage = 'DEPLOY' } = context;
  
  return `# Runbook: Deploy Failure - Stage ${stage}

## O que aconteceu
O deploy falhou na stage **${stage}**.

## Onde olhar

### 1. Log do pipeline
\`\`\`bash
tail -n 500 /tmp/pipeline-oficial-*.log
\`\`\`

### 2. Log do deploy
\`\`\`bash
tail -n 500 /tmp/deploy-aws-*.log
\`\`\`

### 3. Logs de testes (se falhou em TEST)
\`\`\`bash
tail -n 200 /tmp/testar-api-endpoints-*.log
\`\`\`

## Comandos para diagnosticar

### Verificar status AWS
\`\`\`bash
./cicd/verificar-status-aws.sh
\`\`\`

### Testar API pós-deploy
\`\`\`bash
./cicd/testar-api-endpoints.sh http://api.logline.world
\`\`\`

### Verificar logs da aplicação (EC2)
\`\`\`bash
sudo journalctl -u ubl-api -n 100 -f
\`\`\`

## O que esperar ver

- **Se falhou em VALIDATE**: problemas com pré-requisitos ou tags AWS
- **Se falhou em TEST**: testes de API ou integração falharam
- **Se falhou em BUILD**: erro de compilação TypeScript
- **Se falhou em DEPLOY**: problema ao fazer upload ou iniciar serviço

## Próximos passos

1. Identificar a stage exata que falhou
2. Verificar logs específicos dessa stage
3. Corrigir o problema identificado
4. Re-executar o pipeline: \`./cicd/pipeline-oficial.sh\`
`;
}

export function buildRealmInconsistencyRunbook(context: {
  realmId: string;
}): string {
  const { realmId } = context;
  
  return `# Runbook: Realm Inconsistency - ${realmId}

## O que aconteceu
Há uma inconsistência entre o event store e o estado aparente do Realm \`${realmId}\`.

## Onde olhar

### 1. Verificar eventos do Realm
\`\`\`bash
# Via REPL ou CLI (se disponível)
# Buscar eventos do Realm no event store
\`\`\`

### 2. Verificar logs do realm-manager
\`\`\`bash
sudo journalctl -u ubl-api -n 100 | grep "realm-manager"
\`\`\`

## Comandos para diagnosticar

### Reconstruir Realm do event store
O Realm Manager deve reconstruir automaticamente do event store.
Se não estiver funcionando, verifique:

1. Se existe evento \`RealmCreated\` para este Realm
2. Se o event store está acessível
3. Se há erros nos logs do realm-manager

### Verificar Primordial Realm
\`\`\`bash
# O Primordial Realm deve sempre existir
# Verificar se bootstrap foi executado
\`\`\`

## O que esperar ver

- **Realm existe no event store**: deve haver evento \`RealmCreated\`
- **Realm não existe**: \`rebuildRealmFromEvents\` retorna \`null\`
- **Inconsistência**: cache mostra Realm, mas event store não tem eventos

## Próximos passos

1. Verificar se o Realm foi criado via evento (não "hardcoded")
2. Se necessário, recriar o Realm via intent \`createRealm\`
3. Se problema persistir, verificar integridade do event store
4. Consultar \`docs/REALM-CONTRACT.md\` para invariantes
`;
}

// ============================================================================
// AFFORDANCE EXPLANATION
// ============================================================================

export function buildAffordanceExplanation(affordances: readonly { intent: string; label: string; description?: string }[]): string {
  if (affordances.length === 0) {
    return 'Nenhuma ação disponível no momento.';
  }
  
  const items = affordances.map(a => {
    const desc = a.description || a.label;
    return `- **\`${a.intent}\`**: ${desc}`;
  }).join('\n');
  
  return `🛠 **Ações disponíveis agora**

${items}

Você pode:
- Clicar nos botões acima (se a interface suportar)
- Falar em linguagem natural (ex.: "cria um realm de staging isolado")
- Usar os comandos sugeridos abaixo`;
}

