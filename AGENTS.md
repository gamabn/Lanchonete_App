# Instruções de trabalho — Gama Delivery / Frontend

1. Ao iniciar uma tarefa, ler `../BackEnd-lanchonete/PROGRESSO.md`, o registro central de progresso do projeto. Backend e frontend são repositórios separados.
2. Identificar a última etapa concluída e a próxima pendente, considerando também a etapa atual e suas pendências de validação.
3. Não repetir tarefas concluídas sem necessidade. Quando uma revisão for necessária, registrar o motivo.
4. Ao finalizar uma etapa ou sessão de trabalho, atualizar o `PROGRESSO.md` do backend com data, status, resultado, arquivos modificados, testes executados e pendências. Indicar a qual repositório cada arquivo pertence e distinguir testes executados de testes apenas planejados.
5. Não marcar tarefas como concluídas sem validação. Implementação e testes automatizados não substituem validação real quando ela for necessária para a etapa.
6. Antes de implementar alterações no frontend, consultar seu código e suas instruções locais, incluindo eventuais `AGENTS.md` específicos do diretório afetado. Para alterações que envolvam o backend, consultar também `../BackEnd-lanchonete/AGENTS.md`, suas instruções locais e o contrato real da API. Verificar o estado dos dois repositórios independentemente.
7. Preservar autenticação, isolamento multi-tenant e dados existentes. Manter JWT no cookie HttpOnly e encaminhá-lo por proxies autenticados; não expor JWT ou credenciais Baileys ao navegador. A autoridade sobre o restaurante autenticado é o backend, sem aceitar seleção de tenant pelo navegador. Não apagar sessões, remover locks sem verificar se estão ativos, alterar dados reais ou executar migrations fora do escopo autorizado.
8. Manter o histórico objetivo e organizado. Preservar instruções existentes e alterações locais não relacionadas; limitar as mudanças ao escopo solicitado.

Se o backend não estiver no caminho relativo indicado, localizar o repositório informado pelo usuário antes de continuar o acompanhamento. Não criar um segundo registro de progresso divergente no frontend.
