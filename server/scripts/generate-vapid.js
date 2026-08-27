import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("\nAdicione estas variaveis ao ambiente do backend:\n");
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("VAPID_SUBJECT=mailto:seu-email@dominio.com");
console.log("PUSH_SCHEDULER_ENABLED=true");
console.log("PUSH_SCHEDULER_INTERVAL_MINUTES=60");
console.log("PUSH_CRON_SECRET=troque-por-um-segredo-longo\n");
console.log("Guarde as chaves VAPID de forma permanente. Troca-las invalida inscricoes push existentes.\n");
