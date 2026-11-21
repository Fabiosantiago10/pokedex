import notifier from 'node-notifier'

export function notificar(titulo, mensagem) {
  const hora = new Date().toLocaleTimeString('pt-BR')
  console.log(`[${hora}] ${titulo} — ${mensagem}`)
  try {
    notifier.notify({ title: titulo, message: mensagem, sound: true, wait: false, appID: 'Minha Pokédex' })
  } catch {
    // Se a notificação do Windows falhar, a mensagem já saiu no console
  }
}
