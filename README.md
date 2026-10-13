# Penrose — API de e-commerce e ERP

API com NestJS, TypeScript e MongoDB, conectando a experiência de compra à gestão de pedidos e produção sob encomenda.

[Interface](https://github.com/Pmendes38/penrose-estudo-de-caso) · [Ver projeto no portfólio](https://portfolio-iota-woad-84p4egesbx.vercel.app/projetos/penrose)

## Funcionalidades

- Autenticação, perfis de cliente e administrador e autorização nas rotas.
- Produtos, tamanhos, preços em centavos e produção sob encomenda.
- Carrinho, cupons, checkout, pedidos e pagamentos.
- Endereço e modalidade de entrega preservados no pedido.
- ERP: produtos, clientes, pedidos, pagamentos e ordens de serviço.
- Pipeline de produção com quatro etapas, histórico e controle de concorrência.

## Execução local

Requisitos: Node.js e MongoDB local. Copie `env.example` para `.env` e preencha os segredos com valores novos, gerados para seu ambiente.

```sh
npm ci
npm run dev
```

Use `COMMERCE_MODE=demo`, `MONGODB_DB=penrose_demo` e uma conexão local. Nesse modo, pagamentos e entregas são simulados.

Para criar uma conta local, configure `DEMO_ADMIN_PASSWORD` com uma senha própria de pelo menos 16 caracteres. O inicializador opera na base isolada `penrose_demo` com o modo de demonstração habilitado.

## Validar

```sh
npm run build
npm run test:ci
```

## Histórico

O histórico registra a evolução da API, das regras de pedidos e das integrações com o ERP.

Marcas e imagens pertencem aos respectivos titulares.
