<p align="left">
  <img width="400" height="230"  alt="guardei-logo" src="https://github.com/user-attachments/assets/a90dda4f-3977-4ad6-8506-3cdd961b122b" />
</p>

# Guardei - O Seu Acervo Digital Inteligente 🗂️

![Status do Projeto](https://img.shields.io/badge/status-em%20produção-orange)
![Tech Stack](https://img.shields.io/badge/stack-React%20%7C%20Node.js%20%7C%20Gemini%20AI-00E676)
![Tipo](https://img.shields.io/badge/projeto-solo-blueviolet)

<p align="center">
  <strong>Salve, organize e revisite links importantes da internet com o poder da Inteligência Artificial.</strong>
</p>

<p align="center">
  <a href="#-o-buraco-negro-digital">O Problema</a> •
  <a href="#-sobre-o-projeto">Sobre</a> •
  <a href="#-principais-funcionalidades">Funcionalidades</a> •
  <a href="#-arquitetura-e-tecnologias">Tecnologias</a> •
  <a href="#-roadmap-de-desenvolvimento">Roadmap</a> •
  <a href="#-desenvolvedor">Desenvolvedor</a>
</p>

---

## 🕳️ O "Buraco Negro" Digital

Diariamente, consumimos conteúdos valiosos no TikTok, YouTube, X/Twitter, Instagram, Reddit e GitHub. Clicamos em "Salvar" ou "Favoritar" e, na esmagadora maioria das vezes, **nunca mais revisitamos esses links**. 

O **Guardei** foi idealizado para resolver a síndrome da acumulação digital. Mais do que um simples agregador de favoritos, ele é um ecossistema projetado para transformar links esquecidos em conhecimento ativo e acessível, recomendando o conteúdo certo para o seu momento atual.

## 📖 Sobre o Projeto

O **Guardei** é uma aplicação web progressiva (PWA) desenvolvida com auxílio de IA. Ele atua como um acervo pessoal inteligente, centralizando conteúdos de múltiplas plataformas em uma única interface limpa e moderna.

A grande disrupção arquitetural do projeto é a integração com a **API do Google Gemini**, que automatiza o processo de triagem: ao salvar um link, a IA infere o contexto, categoriza, gera *tags* e define a prioridade de consumo. Tudo isso com uma experiência nativa de mobile através do *Web Share Target*, permitindo enviar links diretamente do celular para a plataforma.

---

## ✨ Principais Funcionalidades

- **📥 Ingestão Omnichannel:** Suporte universal para salvamento de links (YouTube, X, Spotify, Instagram, artigos, posts, repositórios).
- **🧠 Organização Neural (Gemini AI):** Classificação automática do link recém-salvo, definindo categorias, *tags*, contexto e nível de prioridade sem intervenção manual.
- **🎯 Motor de Recomendação Contextual:** Sugestões de links para revisitar baseadas no seu tempo livre disponível, humor atual ou formato de conteúdo desejado (vídeo, texto, áudio).
- **📊 Dashboard de Hábitos:** Métricas detalhadas sobre o seu perfil de consumo digital, taxa de revisão de conteúdos e evolução do acervo.
- **🏆 Sistema de Gamificação:** Desbloqueio de conquistas atreladas à consistência no uso e limpeza da fila de leitura.
- **📱 PWA Nativo:** Instalação direta no smartphone (iOS/Android) com suporte a compartilhamento nativo do sistema (Share Sheet) para salvar links em um clique.

---

## 🚀 Arquitetura e Tecnologias

A stack foi selecionada para garantir escalabilidade, processamento ágil de NLP (Linguagem Natural) e uma experiência de usuário sem atritos.

### **Front-end & PWA**
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)

### **Back-end & IA**
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google%20Gemini-8E75B2?style=for-the-badge&logo=googlegemini&logoColor=white)

### **Banco de Dados & Infraestrutura**
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white)
![Neon](https://img.shields.io/badge/Neon_DB-00E599?style=for-the-badge&logo=neon&logoColor=black)
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)

---

## 🗺️ Roadmap de Desenvolvimento

- [x] Definição da arquitetura e modelagem do banco de dados (Prisma/Neon).
- [x] Configuração do manifesto PWA e Web Share Target.
- [x] Integração do backend com a API do Google Gemini para inferência de tags e prioridade.
- [x] Construção do motor de recomendações (Filtros por tempo/humor).
- [x] Desenvolvimento do Dashboard analítico e métricas de consumo.
- [x] Implementação do sistema de gamificação e conquistas.
- [x] Deploy contínuo na plataforma Render.

---

## 👨‍💻 Desenvolvedor

Projeto arquitetado e desenvolvido de forma independente por:

* **João Pedro Araujo Costa** - *Full-Stack Development* - [@joao-araujoo](https://github.com/joao-araujoo)

---

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.
