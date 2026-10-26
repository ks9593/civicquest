
import { useState, type FormEvent } from 'react'
import { supabase } from './lib/supabase'
import './CivicAssistant.css'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

export default function CivicAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Hi! I’m your CivicQuest assistant. Ask me about community participation, civic issues, or constructive actions you can take.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const message = input.trim()
    if (!message || loading) return

    setInput('')
    setError('')
    setMessages((current) => [
      ...current,
      { role: 'user', content: message },
    ])
    setLoading(true)

    try {
      const { data, error: functionError } =
        await supabase.functions.invoke('civic-assistant', {
          body: { message },
        })

      if (functionError) throw functionError
      if (!data?.answer || typeof data.answer !== 'string') {
        throw new Error(data?.error || 'No answer received. Please try again.')
      }

      setMessages((current) => [
        ...current,
        { role: 'assistant', content: data.answer },
      ])
    } catch (err) {
      console.error('Civic assistant error:', err)
      setError(
        'I couldn’t get a response. Please check that you are signed in and try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="civic-assistant" aria-label="CivicQuest AI assistant">
      <header className="civic-assistant__header">
        <div>
          <h2>CivicQuest AI</h2>
          <p>Your guide to positive community action</p>
        </div>
        <span className="civic-assistant__status">AI Assistant</span>
      </header>

      <div className="civic-assistant__messages" aria-live="polite">
        {messages.map((message, index) => (
          <div
            key={`${index}-${message.role}`}
            className={`civic-assistant__message civic-assistant__message--${message.role}`}
          >
            <span className="civic-assistant__role">
              {message.role === 'user' ? 'You' : 'CivicQuest AI'}
            </span>
            <p>{message.content}</p>
          </div>
        ))}

        {loading && (
          <div className="civic-assistant__loading">
            CivicQuest AI is thinking…
          </div>
        )}
      </div>

      {error && (
        <p className="civic-assistant__error" role="alert">
          {error}
        </p>
      )}

      <form className="civic-assistant__form" onSubmit={sendMessage}>
        <label className="civic-assistant__label" htmlFor="civic-ai-message">
          Ask a civic question
        </label>
        <div className="civic-assistant__input-row">
          <input
            id="civic-ai-message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="How can I help my community?"
            maxLength={1500}
            disabled={loading}
            autoComplete="off"
          />
          <button type="submit" disabled={loading || !input.trim()}>
            {loading ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </section>
  )
}
