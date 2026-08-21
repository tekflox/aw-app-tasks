---
repo: architecture
path: docs/architecture/aw-app-tasks.md
source: generated
edited: false
checksum: sha256:1e5c79c6e4bf89199968b26a4126c9ab795e651306ce26063e1ab73abee25f3a
---
# Scheduled Tasks

- **repo**: aw-app-tasks
- **layer**: app
- **technologies**: python, react
- **health** (derived): planned

Scheduled prompts/commands that fire into a reusable CLI session or run a cheap shell check and notify on a notable exit code. Migrated from the aw monolith (src/mcp/tasks.py + tools/agentic_output.py, src/api/task_manager.py + task_scheduler.py + routes/tasks.py, TasksTab.jsx).

## Connections
- `db` → **postgres** — app-owned tables in the workspace schema
- `http` → **aw-workspace** — routes mounted at /api/apps/tasks
- `stdio-mcp` → **mcp-gateway** — MCP surface aggregated by the gateway

## MCP tools
- `create_task`
- `delete_task`
- `get_task`
- `list_clis`
- `list_tasks`
- `open_task`
- `run_task`
- `update_task`

## Requirements
### Task contribuída por app é criada se não existir, nunca atualizada
- Given um app declara contributes.tasks e já existe uma task com o mesmo nome, que o usuário desabilitou, reagendou ou teve o comando reescrito
- When o workspace entrega a declaração ao provider na ativação e ele casa por nome (repos/aw-app-tasks/tasks_app/plugin.py::TasksAppPlugin.register_contributed_task:59)
- Then a task existente fica exatamente como está e o retorno é False — reafirmar a versão do app a cada boot desfaz em silêncio o ajuste que a pessoa fez, e casar por nome em vez de por id do app também faz com que uma task criada à mão seja reconhecida em vez de duplicada
- intended_status: `not_implemented` · derived health: `not_implemented`
- tests: `repos/aw-app-tasks/tests/test_contributed_tasks.py` (passing)

### Uma task agent_prompt semeada carrega o slug do agente que a dispara
- Given um app entrega uma task do tipo agent_prompt junto com o agente que ela deve acionar
- When a linha é criada a partir da declaração (repos/aw-app-tasks/tasks_app/plugin.py::TasksAppPlugin.register_contributed_task:59, campo agent_slug normalizado no create)
- Then agent_slug chega preenchido na linha, e ausente ou em branco vira None e não string vazia — o campo foi descartado até 13/08 e o resultado era uma task instalada, visível e habilitável que simplesmente nunca rodava, porque _run_agent_prompt não tem para quem despachar com o slug nulo
- intended_status: `not_implemented` · derived health: `not_implemented`
- tests: `repos/aw-app-tasks/tests/test_contributed_tasks.py` (passing)

### Task semeada por install nasce desligada
- Given um app é instalado declarando tasks agendadas sem dizer explicitamente enabled
- When a linha é criada (repos/aw-app-tasks/tasks_app/plugin.py::TasksAppPlugin.register_contributed_task:59, default enabled=False)
- Then a task existe e aparece na tela mas não dispara até alguém ligá-la, e um app pode sobrescrever se quiser — o agendamento semeado é sugestão, e uma task que começa a rodar no instante do install executa trabalho que ninguém pediu num horário que ninguém escolheu, o que só é percebido pelo efeito colateral
- intended_status: `not_implemented` · derived health: `not_implemented`
- tests: `repos/aw-app-tasks/tests/test_contributed_tasks.py` (passing)
