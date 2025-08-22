import { desktopInput, desktopPrompt } from './utilities/Notification'

async function main() {
//   const messages = [
//     'Happy birthday @jesse! :party_hat:',
//     'Happy birthday @jesse! :party_hat:',
//     'Happy birthday @jesse! :party_hat:',
//     'Happy birthday @jesse! :party_hat:',
//   ]
//
//   const testMessage = 'Hey @jesse!, Happy birthday, have a great day'
//
//   const actual =`Birthday detected
// Messages seen:
// ${messages.map(m => `- ${m}`).join('\n')}
//
// Candidate message: "${testMessage}"
//
// Should I send it?`
//   const x = await zenityPrompt('test', actual)
  const x = await desktopInput('Custom Birthday message', 'Enter your own birthday message')
  console.log(x)
}

void main()
