
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Bot, LoaderCircle, MapPin, RotateCcw, Send, Sparkles, User, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './CivicAssistant.css'

type Quest = {
  id: string
  title: string
  description: string | null
  category: string | null
  location_name: string | null
  status: string | null
  xp_reward: number | null
  latitude: number | null
  longitude: number | null
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
}

const STARTERS = [
  'What quests are open right now?',
  'How can I report a civic issue?',
  'How should I prioritize community problems?',
  'Explain how CivicQuest works',
]

const MAX_INPUT_LENGTH = 1500

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export default function CivicAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hi! I’m your CivicQuest AI Assistant. I can explain civic participation, help you plan constructive community action, and answer questions about the open quests currently available in CivicQuest.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [quests, setQuests] = useState<Quest[]>([])
  const [questsNotice, setQuestsNotice] = useState('')
  const [showTips, setShowTips] = useState(true)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    let active = true

    async function loadQuests() {
      const { data, error: queryError } = await supabase
        .from('quests')
        .select(
          'id,title,description,category,location_name,status,xp_reward,latitude,longitude',
        )
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(50)

      if (!active) return

      if (queryError) {
        setQuestsNotice(
          'Live quest data is unavailable right now. You can still ask general civic questions.',
        )
        return
      }

      setQuests((data ?? []) as Quest[])
      setQuestsNotice('')
    }

    void loadQuests()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight
    }
  }, [messages, loading])

  const questContext = useMemo(
    () =>
      quests.map((quest) => ({
        title: quest.title,
        description: quest.description ?? '',
        category: quest.category ?? 'General',
        location: quest.location_name ?? 'Location not specified',
        status: quest.status ?? 'unknown',
        xp_reward: quest.xp_reward ?? 0,
        has_map_pin:
          typeof quest.latitude === 'number' &&
          typeof quest.longitude === 'number',
      })),
    [quests],
  )

  const sendMessage = useCallback(
    async (rawText: string) => {
      const message = rawText.trim()

      if (!message || loading) return

      if (message.length > MAX_INPUT_LENGTH) {
        setError(`Please keep messages under ${MAX_INPUT_LENGTH} characters.`)
        return
      }

      const userMessage: ChatMessage = {
        id: makeId(),
        role: 'user',
        content: message,
      }

      const history = [...messages, userMessage]

      setMessages(history)
      setInput('')
      setError('')
      setLoading(true)

      try {
        const { data, error: invokeError } =
          await supabase.functions.invoke('civic-assistant', {
            body: {
              message,
              history: history
                .filter((item) => item.id !== 'welcome')
                .slice(-8)
                .map(({ role, content }) => ({ role, content })),
              quests: questContext,
            },
          })

        if (invokeError) throw invokeError

        if (typeof data?.answer !== 'string' || !data.answer.trim()) {
          throw new Error(
            data?.error || 'The assistant returned an empty answer.',
          )
        }

        setMessages((current) => [
          ...current,
          {
            id: makeId(),
            role: 'assistant',
            content: data.answer.trim(),
          },
        ])
      } catch (caught) {
        const fallback =
          caught instanceof Error
            ? caught.message
            : 'The assistant could not answer right now.'

        setError(
          fallback.includes('Failed to fetch')
            ? 'Could not reach the assistant. Check your connection and try again.'
            : fallback,
        )
      } finally {
        setLoading(false)
        inputRef.current?.focus()
      }
    },
    [loading, messages, questContext],
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendMessage(input)
  }

  function resetChat() {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          'Chat cleared. What would you like help with in your community today?',
      },
    ])
    setInput('')
    setError('')
    inputRef.current?.focus()
  }

  return (
    <section className="civic-ai" aria-label="CivicQuest AI Assistant">
      <div className="civic-ai__header">
        <div className="civic-ai__brand-icon">
          <Bot size={24} />
        </div>

        <div className="civic-ai__heading">
          <div className="civic-ai__title-row">
            <h3>CivicQuest AI</h3>
            <span className="civic-ai__online">
              <span /> AI assistant
            </span>
          </div>
          <p>Community guidance grounded in available CivicQuest data</p>
        </div>

        <button
          type="button"
          className="civic-ai__icon-button"
          onClick={resetChat}
          title="Clear conversation"
          aria-label="Clear conversation"
        >
          <RotateCcw size={17} />
        </button>
      </div>

      <div className="civic-ai__context">
        <div className="civic-ai__context-icon">
          <MapPin size={17} />
        </div>
        <div>
          <strong>
            {quests.length} open quest{quests.length === 1 ? '' : 's'} loaded
          </strong>
          <p>
            {questsNotice ||
              'The assistant can use current open quest titles, categories, locations and XP values.'}
          </p>
        </div>
      </div>

      <div
        className="civic-ai__messages"
        ref={listRef}
        aria-live="polite"
        aria-label="Conversation"
      >
        {messages.map((message) => (
          <div
            className={`civic-ai__message civic-ai__message--${message.role}`}
            key={message.id}
          >
            <div className="civic-ai__avatar">
              {message.role === 'assistant' ? (
                <Bot size={17} />
              ) : (
                <User size={17} />
              )}
            </div>

            <div className="civic-ai__bubble">
              <span className="civic-ai__role">
                {message.role === 'assistant' ? 'CivicQuest AI' : 'You'}
              </span>
              <p>{message.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="civic-ai__message civic-ai__message--assistant">
            <div className="civic-ai__avatar">
              <Bot size={17} />
            </div>
            <div className="civic-ai__bubble civic-ai__typing">
              <LoaderCircle size={16} className="civic-ai__spinner" />
              <span>Thinking through your question…</span>
            </div>
          </div>
        )}
      </div>

      {showTips && messages.length <= 1 && (
        <div className="civic-ai__starter-area">
          <div className="civic-ai__starter-heading">
            <Sparkles size={15} /> Try asking
            <button
              type="button"
              onClick={() => setShowTips(false)}
              aria-label="Hide suggestions"
            >
              <X size={14} />
            </button>
          </div>

          <div className="civic-ai__starters">
            {STARTERS.map((starter) => (
              <button
                type="button"
                key={starter}
                disabled={loading}
                onClick={() => void sendMessage(starter)}
              >
                {starter}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="civic-ai__error" role="alert">
          {error}
        </div>
      )}

      <form className="civic-ai__composer" onSubmit={handleSubmit}>
        <label
          className="civic-ai__sr-only"
          htmlFor="civic-ai-input"
        >
          Ask CivicQuest AI
        </label>

        <textarea
          id="civic-ai-input"
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void sendMessage(input)
            }
          }}
          placeholder="Ask about quests or civic action…"
          rows={2}
          maxLength={MAX_INPUT_LENGTH}
          disabled={loading}
        />

        <div className="civic-ai__composer-footer">
          <span>Enter to send · Shift+Enter for a new line</span>
          <span className="civic-ai__counter">
            {input.length}/{MAX_INPUT_LENGTH}
          </span>

          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send message"
          >
            {loading ? (
              <LoaderCircle className="civic-ai__spinner" size={17} />
            ) : (
              <Send size={17} />
            )}
            <span>Send</span>
          </button>
        </div>
      </form>

      <p className="civic-ai__disclaimer">
        AI can make mistakes. Confirm important information with a responsible
        administrator. It cannot approve quests or award rewards.
      </p>
    </section>
  )
}
