# Penrose — API de estudo de caso

API de comércio eletrônico e ERP com NestJS, TypeScript e MongoDB. Implementação real sanitizada para avaliação técnica, sem o banco ou as credenciais de produção.

[Interface correspondente](https://github.com/Pmendes38/penrose-estudo-de-caso)

## Funcionalidades

- Autenticação, perfis de cliente e administrador e autorização nas rotas.
- Produtos, tamanhos, preços em centavos e produção sob encomenda.
- Carrinho, cupons, checkout, pedidos e pagamentos de demonstração.
- Endereço e modalidade de entrega preservados no pedido.
- ERP: produtos, clientes, pedidos, pagamentos e ordens de serviço.
- Pipeline de produção com quatro etapas, histórico e controle de concorrência.

## Execução local

Requisitos: Node.js e MongoDB local. Copie `env.example` para `.env` e preencha os segredos com valores novos, gerados somente para sua máquina.

```sh
npm ci
npm run dev
```

Use `COMMERCE_MODE=demo`, `MONGODB_DB=penrose_demo` e uma conexão local. Não inclua chaves de gateways ou transportadoras; não conecte esta versão à produção.

O arquivo de exemplo não contém senha de administrador. Se quiser criar uma conta local, configure `DEMO_ADMIN_PASSWORD` com uma senha própria de pelo menos 16 caracteres e execute a compilação. O inicializador só opera na base isolada `penrose_demo` e com o modo de demonstração habilitado.

```sh
npm run build
npm run test:ci
```

## Limites

Pagamentos e entregas na demonstração são fictícios. O contador de resgates de cupons nesse fluxo ainda exige revisão. Cobrança real, emissão fiscal e transporte real não foram executados como parte deste estudo. Revise segurança e dependências antes de qualquer uso comercial.

## Histórico

Os 15 commits da linha de desenvolvimento foram preservados, sem condensação em um commit único. Configurações, contatos e endpoints privados foram removidos também das versões antigas. Os identificadores foram reescritos; datas, sequência e autoria nominal foram mantidas. E-mails de outros contribuidores foram substituídos por endereços de privacidade.

Uma verificação de segredos cobriu todo o histórico a publicar, sem achados nas regras utilizadas; isso não substitui auditoria de segurança. Esta não é a base oficial da loja.

O código é disponibilizado para leitura, execução local e avaliação técnica. Marcas e imagens não recebem licença comercial por esta publicação.
