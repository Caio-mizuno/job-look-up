/**
 * Tecnologias que a aba Estudo procura nas vagas, agrupadas por tema.
 * Texto = nome inteiro, sem diferenciar maiúsculas. RegExp = casos ambíguos
 * ("Go", "REST", "Spring"), em que só a grafia própria conta.
 * knownWith: quem tem uma dessas no perfil já conhece a base (React → JavaScript).
 */
export type Tech = { name: string; match: (string | RegExp)[]; knownWith?: string[] };
export type Theme = { id: string; label: string; techs: Tech[] };

const t = (name: string, ...match: (string | RegExp)[]): Tech => ({ name, match: match.length ? match : [name.toLowerCase()] });
const FRONT_FRAMEWORKS = ["React", "Angular", "Vue", "Next.js", "Svelte", "Nuxt", "React Native"];

export const THEMES: Theme[] = [
  {
    id: "frontend",
    label: "Front-end",
    techs: [
      t("React", "react", "react.js", "reactjs"),
      t("Angular", "angular", "angularjs"),
      t("Vue", "vue", "vue.js", "vuejs"),
      t("Next.js", "next.js", "nextjs"),
      { ...t("HTML", "html", "html5"), knownWith: FRONT_FRAMEWORKS },
      t("Svelte"),
      t("Nuxt", "nuxt", "nuxt.js", "nuxtjs"),
    ],
  },
  {
    id: "state",
    label: "Controle de estado",
    techs: [
      t("Redux", "redux", "redux toolkit", "rtk query"),
      t("Zustand"),
      t("Jotai"),
      t("Context API", "context api", "react context"),
      t("MobX"),
      t("Recoil"),
      t("React Query", "react query", "react-query", "tanstack query"),
      t("NgRx"),
      t("Pinia"),
      t("Vuex"),
    ],
  },
  {
    id: "styling",
    label: "Estilização",
    techs: [
      { ...t("CSS", "css", "css3"), knownWith: [...FRONT_FRAMEWORKS, "Tailwind", "Sass", "Bootstrap"] },
      t("Tailwind", "tailwind", "tailwindcss"),
      t("Sass", "sass", "scss"),
      t("Styled Components", "styled-components", "styled components"),
      t("Bootstrap"),
      t("Material UI", "material ui", "material-ui", "mui"),
    ],
  },
  {
    id: "languages",
    label: "Linguagens",
    techs: [
      { ...t("JavaScript", "javascript", "ecmascript"), knownWith: [...FRONT_FRAMEWORKS, "TypeScript", "Node.js", "NestJS", "Express"] },
      t("TypeScript"),
      t("Python"),
      t("Java"),
      t("C#", "c#", "csharp"),
      t("PHP"),
      t("Go", "golang", /\bGo\b/),
      t("Kotlin"),
      t("Ruby"),
      t("C++", "c++"),
      t("Swift", "swiftui", /\bSwift\b/),
      t("Rust", /\bRust\b/),
      t("Elixir"),
      t("Scala"),
      t("Dart", /\bDart\b/),
    ],
  },
  {
    id: "backend",
    label: "Back-end",
    techs: [
      t("Node.js", "node.js", "nodejs", "node"),
      t("Spring", "spring boot", /\bSpring\b/),
      t(".NET", ".net", "dotnet", "asp.net"),
      t("Laravel"),
      t("NestJS", "nestjs", "nest.js"),
      t("Django"),
      t("Express", "expressjs", "express.js", /\bExpress\b/),
      t("FastAPI"),
      t("Flask"),
      t("Symfony"),
      t("Ruby on Rails", "ruby on rails", "rails"),
    ],
  },
  {
    id: "apis",
    label: "APIs e arquitetura de serviços",
    techs: [
      t("REST", "restful", "api rest", "rest api", /\bREST\b/),
      t("Microsserviços", "microsserviços", "microsservicos", "microserviços", "microservices", "microservice", "micro-serviços"),
      t("GraphQL"),
      t("gRPC"),
      t("WebSocket", "websocket", "websockets"),
    ],
  },
  {
    id: "databases",
    label: "Banco de dados",
    techs: [
      { ...t("SQL"), knownWith: ["PostgreSQL", "MySQL", "SQL Server", "Oracle"] },
      t("PostgreSQL", "postgresql", "postgres"),
      t("MySQL", "mysql", "mariadb"),
      t("MongoDB", "mongodb", "mongo"),
      t("Redis"),
      t("SQL Server", "sql server", "mssql"),
      t("Oracle", "oracle", "pl/sql", "plsql"),
      t("Elasticsearch", "elasticsearch", "elastic search"),
      t("DynamoDB"),
    ],
  },
  {
    id: "cloud",
    label: "Cloud",
    techs: [
      t("AWS", "aws", "amazon web services"),
      t("Azure"),
      t("GCP", "gcp", "google cloud"),
      t("Serverless", "serverless", "aws lambda"),
    ],
  },
  {
    id: "devops",
    label: "DevOps e CI/CD",
    techs: [
      t("Git", "git", "github", "gitlab"),
      t("Docker", "docker", "docker compose"),
      t("CI/CD", "ci/cd", "ci cd", "integração contínua", "continuous integration"),
      t("Kubernetes", "kubernetes", "k8s"),
      t("Linux"),
      t("Terraform"),
      t("GitHub Actions", "github actions"),
      t("Jenkins"),
    ],
  },
  {
    id: "messaging",
    label: "Mensageria",
    techs: [t("Kafka"), t("RabbitMQ", "rabbitmq", "amqp"), t("SQS", "sqs", "amazon sqs")],
  },
  {
    id: "testing",
    label: "Testes",
    techs: [
      t("Testes automatizados", "testes automatizados", "testes unitários", "unit tests", "unit testing", "automated tests"),
      t("TDD", "tdd", "test driven"),
      t("Jest"),
      t("Cypress"),
      t("Playwright"),
      t("Selenium"),
      t("JUnit"),
      t("PHPUnit"),
      t("Pytest"),
      t("Vitest"),
      t("Testing Library", "testing library", "testing-library"),
    ],
  },
  {
    id: "mobile",
    label: "Mobile",
    techs: [t("React Native", "react native", "react-native"), t("Flutter"), t("Android"), t("iOS", /\biOS\b/)],
  },
  {
    id: "practices",
    label: "Práticas e arquitetura",
    techs: [
      t("Scrum"),
      t("Metodologias ágeis", "metodologias ágeis", "métodos ágeis", "ágil", "agile"),
      t("Kanban"),
      t("SOLID", /\bSOLID\b/),
      t("Clean Architecture", "clean architecture", "arquitetura limpa"),
      t("Design Patterns", "design patterns", "padrões de projeto"),
      t("DDD", "ddd", "domain driven", "domain-driven"),
      t("Clean Code", "clean code"),
    ],
  },
  {
    id: "data",
    label: "Dados e IA",
    techs: [
      t("Machine Learning", "machine learning", "aprendizado de máquina"),
      t("IA generativa", "ia generativa", "generative ai", "genai", "llm", "llms"),
      t("Power BI", "power bi"),
      t("Spark", "spark", "pyspark"),
      t("Pandas"),
      t("Airflow"),
    ],
  },
];
