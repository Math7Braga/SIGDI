# SIGDI — Sistema Integrado de Gestão do Distrito de Inovação

Painel de gestão do **Distrito de Inovação Cantareira**. Reúne em uma única tela os principais indicadores de governança, parcerias, projetos, agenda, comunicação, processos, inteligência e memória institucional.

Os dados vêm de uma **planilha do Google Sheets** e de um **Google Calendar**, lidos em tempo real pelo navegador. Para atualizar o painel, basta editar a planilha: não é preciso mexer no código nem fazer novo deploy.

---

## Módulos

| # | Módulo | O que mostra |
|---|--------|--------------|
| — | Visão Geral | Todos os cartões do painel em uma só tela |
| 1 | Governança | Reuniões, deliberações do CDT e pendências |
| 2 | Parcerias | Funil de parcerias por etapa |
| 3 | Projetos Estratégicos | Fase, progresso, próximo marco e risco |
| 4 | Agenda e Ecossistema | Eventos, visitas técnicas, solicitações e calendário completo |
| 5 | Comunicação Institucional | Publicações por canal, matérias e alcance |
| 6 | Processos Estratégicos | Nível e status dos processos |
| 7 | Inteligência | Oportunidades por estágio |
| 8 | Memória Institucional | Reuniões, documentos, decisões e mídia registrados |
| 9 | Indicadores Gerais | Panorama geral do Distrito |

Cada cartão pode ser aberto para exibir gráficos e detalhes.

---

## Tecnologias

- HTML, CSS e JavaScript puro (sem framework e sem etapa de build)
- [Chart.js 4.4.1](https://www.chartjs.org/) via CDN, para os gráficos
- Google Sheets (endpoint `gviz`), para a leitura dos dados
- Google Calendar API, para a agenda

---

## Estrutura do projeto

```
.
├── index.html     # Estrutura da página
├── style.css      # Estilos
├── script.js      # Lógica, leitura da planilha e do calendário
├── logo.png       # Logo exibida no cabeçalho
├── LogoNAV.png    # Favicon
└── README.md
```

> Os nomes dos arquivos devem ser mantidos exatamente assim, incluindo maiúsculas e minúsculas. Hospedagens como a Vercel diferenciam os dois.

---

## Como funciona a atualização dos dados

- O painel lê a planilha ao abrir e **refaz a leitura a cada 60 segundos**.
- Alterou algo na planilha? Em até 1 minuto o painel mostra o novo valor.
- Se a planilha não puder ser lida, o painel exibe **dados de demonstração** e avisa no rodapé.
- A agenda é buscada no Google Calendar a cada mês navegado.

---

## Configuração

Toda a configuração está no início do `script.js`.

### 1. Planilha (Google Sheets)

1. Abra a planilha e clique em **Compartilhar → Qualquer pessoa com o link → Leitor**.
2. Copie o ID da planilha (trecho da URL entre `/d/` e `/edit`).
3. Cole no `script.js`:

```js
const SHEET_ID = "ID_DA_SUA_PLANILHA";
```

A planilha deve ter as abas abaixo, com as colunas **nesta ordem exata** (a leitura é por posição, não pelo nome do cabeçalho):

| Aba | Colunas |
|-----|---------|
| `KPIs` | `Chave`, `Valor`, `Descricao` |
| `Projetos` | `Projeto`, `Fase`, `Progresso`, `ProximoMarco`, `Risco` |
| `Parcerias` | `Nome`, `Etapa` |
| `Pendencias` | `Descricao`, `Prioridade` |
| `Processos` | `Nome`, `Nivel`, `Status` |
| `Oportunidades` | `Nome`, `Status` |

#### Chaves da aba `KPIs`

Cada linha da aba `KPIs` tem uma **Chave** (abaixo) e o **Valor** correspondente:

| Módulo | Chaves |
|--------|--------|
| Governança | `gov_reunioes_realizadas`, `gov_deliberacoes_aprovadas`, `gov_deliberacoes_pendentes` |
| Agenda | `agenda_eventos_realizados`, `agenda_eventos_previstos`, `agenda_visitas_tecnicas`, `agenda_solicitacoes` |
| Comunicação | `com_linkedin`, `com_instagram`, `com_materias`, `com_alcance` |
| Memória | `mem_reunioes`, `mem_documentos`, `mem_decisoes`, `mem_fotos` |
| Indicadores | `ind_parcerias`, `ind_projetos`, `ind_eventos`, `ind_visitas` |

### 2. Agenda (Google Calendar)

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e ative a **Google Calendar API**.
2. Em **APIs e serviços → Credenciais**, crie uma **chave de API**.
3. Torne a agenda pública no Google Calendar (Configurações → Permissões de acesso).
4. Preencha no `script.js`:

```js
const CALENDAR_ID = "seu-calendario@gmail.com";
const CALENDAR_API_KEY = "SUA_CHAVE_DE_API";
```

#### Segurança da chave de API

A chave fica visível no código do navegador. Para evitar uso indevido, no Google Cloud Console:

- restrinja a chave somente à **Google Calendar API**;
- em **Restrições de aplicativo**, escolha **Referenciadores HTTP** e informe seu domínio (por exemplo `https://seu-projeto.vercel.app/*`).

---

## Executando localmente

Não há dependências para instalar. Basta servir a pasta com qualquer servidor estático:

```bash
# Python
python3 -m http.server 8000

# ou Node
npx serve .
```

Depois acesse `http://localhost:8000`.

> Se você usar uma chave de API com restrição de referenciador, adicione também `http://localhost:8000/*` à lista durante os testes.

---

## Deploy na Vercel

1. Envie os arquivos para um repositório no GitHub (na raiz).
2. Na [Vercel](https://vercel.com), clique em **Add New → Project** e importe o repositório.
3. Em **Framework Preset**, selecione **Other**. Deixe vazios os campos de *Build Command* e *Output Directory*.
4. Clique em **Deploy**.
5. Adicione a URL gerada às restrições da chave de API (veja a seção de segurança acima).

Novos commits na branch principal geram um novo deploy automaticamente. Alterações na planilha **não** exigem deploy.

---

## Solução de problemas

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| Rodapé mostra "Não foi possível ler a planilha… dados de demonstração" | Planilha não está compartilhada como leitura pública, ou `SHEET_ID` incorreto | Revise o compartilhamento e o ID |
| Valores aparecem como `–` ou vazios | Chave da aba `KPIs` com nome diferente do esperado | Confira a grafia das chaves na tabela acima |
| Tabela com colunas vazias ou erradas | Ordem das colunas diferente do esperado | Reordene as colunas da aba conforme a tabela de configuração |
| Calendário não carrega | Chave de API inválida, restrição de domínio incorreta ou agenda privada | Verifique a chave, os referenciadores e a visibilidade da agenda |
| Logo ou estilo não aparecem após o deploy | Diferença de maiúsculas/minúsculas no nome do arquivo | Mantenha `logo.png`, `LogoNAV.png`, `style.css` e `script.js` exatamente como no `index.html` |

---

## Observações

- A leitura é **somente leitura**: o painel nunca grava dados na planilha.
- Como a planilha precisa ser pública para leitura, evite colocar informações sensíveis nela.

---

## Licença

Defina aqui a licença do projeto (por exemplo, MIT) ou indique que é de uso interno do Distrito de Inovação Cantareira.
