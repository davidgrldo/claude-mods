import type { Register } from 'claude-code'

// The smallest useful mod: register a slash command, answer it, and show a toast.
// Copy this folder to plugins/<your-mod>, rename it in plugin.json, and build from here.
//
// Other things a mod can do, each with an example in Claude Code's plugin-authoring skill:
//   - a band above the prompt:  on('ui.render', { component: 'AbovePrompt' }, ...)
//   - a docked pane:            $.ui.open({ id, title }) + on('ui.render', { component: 'Pane', requestId: id }, ...)
//   - react to tools / prompts: on('tool.call', ...), on('prompt.submit', ...)
export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'hello', description: 'Say hello from the template mod' })
    return next(e)
  })

  on('command.run', { command: 'hello' }, async $ => {
    $.ui.toast('Hello from hello-mod')
    $.ui.status('hello-mod')
    return { text: 'Hello! This reply comes from the template mod.' }
  })
}
