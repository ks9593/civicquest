import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from './lib/supabase'
import {
  Globe2,
  Mail,
  Lock,
  User,
  MapPin,
  ArrowRight,
  LoaderCircle,
  Building2,
  Sparkles,
  ShieldCheck,
  HeartHandshake,
  Leaf,
  Users,
  CheckCircle2,
} from 'lucide-react'

type AuthProps = {
  onAuthenticated: () => void
}

type Area = {
  id: string
  name: string
}

type AccountType = 'citizen' | 'company'

export default function Auth({ onAuthenticated }: AuthProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [accountType, setAccountType] = useState<AccountType>('citizen')
  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [areas, setAreas] = useState<Area[]>([])
  const [areaId, setAreaId] = useState('')
  const [areasLoading, setAreasLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadAreas() {
      setAreasLoading(true)
      const { data, error } = await supabase
        .from('areas')
        .select('id, name')
        .order('name', { ascending: true })

      if (!active) return

      if (error) {
        setError(`Could not load areas: ${error.message}`)
      } else {
        const loadedAreas = (data || []) as Area[]
        setAreas(loadedAreas)
        if (loadedAreas.length === 1) setAreaId(loadedAreas[0].id)
      }

      setAreasLoading(false)
    }

    void loadAreas()
    return () => {
      active = false
    }
  }, [])

  async function submitCompanyApplication(
    userId: string,
    company: string,
    userEmail: string,
    selectedAreaId: string,
  ) {
    // Avoid creating duplicate applications when a company signs in again.
    const { data: existing, error: lookupError } = await supabase
      .from('company_applications')
      .select('id, status')
      .eq('user_id', userId)
      .maybeSingle()

    if (lookupError) {
      throw new Error(`Could not check your company application: ${lookupError.message}`)
    }
    if (existing) return existing.status as string

    const { error: insertError } = await supabase
      .from('company_applications')
      .insert({
        user_id: userId,
        company_name: company,
        email: userEmail,
        area_id: selectedAreaId,
      })

    if (insertError) {
      throw new Error(`Could not submit your company application: ${insertError.message}`)
    }
    return 'pending'
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      if (mode === 'signup') {
        if (!areaId) throw new Error('Please select your area.')
        const selectedArea = areas.find((area) => area.id === areaId)
        if (!selectedArea) throw new Error('Please select an available area.')
        if (accountType === 'citizen' && !name.trim()) throw new Error('Please enter your name.')
        if (accountType === 'company' && !companyName.trim()) {
          throw new Error('Please enter your company name.')
        }

        const displayName = accountType === 'company' ? companyName.trim() : name.trim()
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: displayName,
              area_id: areaId,
              area_name: selectedArea.name,
              account_type: accountType,
              company_name: accountType === 'company' ? companyName.trim() : null,
            },
          },
        })

        if (signUpError) throw signUpError

        if (data.session && data.user) {
          // Public sign-ups always start as citizens; company access is reviewed separately.
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert(
              {
                id: data.user.id,
                display_name: displayName,
                area_id: areaId,
                role: 'citizen',
              },
              { onConflict: 'id' },
            )

          if (profileError) {
            throw new Error(`Account created, but profile setup failed: ${profileError.message}`)
          }

          if (accountType === 'company') {
            const status = await submitCompanyApplication(
              data.user.id,
              companyName.trim(),
              email.trim(),
              areaId,
            )
            setMessage(
              status === 'approved'
                ? 'Your company application is already approved. Your company dashboard access must be enabled by the app.'
                : status === 'rejected'
                  ? 'Your company application was previously rejected. Please contact the administrator.'
                  : 'Company account created! Your application is pending Super Admin approval.',
            )
            return
          }

          onAuthenticated()
        } else {
          setMessage(
            accountType === 'company'
              ? 'Company account created. Confirm your email, then sign in. Your company application will be submitted after confirmation.'
              : 'Account created. Confirm your email, then sign in.',
          )
        }
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) throw signInError

        const user = data.user
        if (!user) throw new Error('Sign-in succeeded, but no user was returned.')

        // Metadata identifies company registrations but never grants elevated database roles.
        const metadata = user.user_metadata || {}
        const isCompany = metadata.account_type === 'company'

        if (isCompany) {
          const metadataCompanyName =
            typeof metadata.company_name === 'string' ? metadata.company_name.trim() : ''
          const metadataAreaId = typeof metadata.area_id === 'string' ? metadata.area_id : ''

          if (!metadataCompanyName || !metadataAreaId) {
            throw new Error('Company details are incomplete. Please contact the administrator.')
          }

          const status = await submitCompanyApplication(
            user.id,
            metadataCompanyName,
            user.email || email.trim(),
            metadataAreaId,
          )

          setMessage(
            status === 'approved'
              ? 'Your company application is approved. Company dashboard access still needs to be enabled in CivicQuest.'
              : status === 'rejected'
                ? 'Your company application was rejected. Please contact the administrator.'
                : 'Signed in successfully. Your company application is pending Super Admin approval.',
          )
          return
        }

        onAuthenticated()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'signup' : 'login')
    setError('')
    setMessage('')
  }

  return (
    <main className="auth-page auth-page-premium">
      <div className="auth-orb auth-orb-one" aria-hidden="true" />
      <div className="auth-orb auth-orb-two" aria-hidden="true" />

      <div className="auth-layout">
        <aside className="auth-showcase">
          <div className="auth-showcase-top">
            <span className="auth-showcase-logo"><Globe2 size={23} /></span>
            <span className="auth-showcase-brand">civic<span>quest</span></span>
            <span className="auth-live-pill"><span /> COMMUNITY POWERED</span>
          </div>

          <div className="auth-showcase-copy">
            <p className="auth-kicker"><Sparkles size={14} /> SMALL ACTIONS. REAL IMPACT.</p>
            <h2>Make your<br />corner of the<br /><em>world better.</em></h2>
            <p className="auth-showcase-description">
              Turn everyday good deeds into meaningful change. Find local quests,
              help your neighbours, and build a stronger community together.
            </p>
            <div className="auth-impact-points">
              <div><span className="auth-impact-icon"><Leaf size={17} /></span><span><strong>Act locally</strong><small>Discover things you can do nearby</small></span></div>
              <div><span className="auth-impact-icon"><Users size={17} /></span><span><strong>Grow together</strong><small>Team up with people who care</small></span></div>
              <div><span className="auth-impact-icon"><ShieldCheck size={17} /></span><span><strong>Build trust</strong><small>Show your community contributions</small></span></div>
            </div>
          </div>

          <div className="auth-showcase-bottom">
            <div className="auth-avatar-stack" aria-hidden="true">
              <span>Y</span><span>A</span><span>R</span><span><HeartHandshake size={15} /></span>
            </div>
            <p><strong>Progress starts with people.</strong><small>Every helpful action counts.</small></p>
            <div className="auth-sparkle"><CheckCircle2 size={22} /></div>
          </div>
          <div className="auth-decor-ring auth-decor-ring-one" aria-hidden="true" />
          <div className="auth-decor-ring auth-decor-ring-two" aria-hidden="true" />
        </aside>

        <section className="auth-card auth-card-premium">
          <div className="auth-mobile-brand">
            <span className="auth-logo"><Globe2 size={23} /></span>
            <span>civic<strong>quest</strong></span>
          </div>

          <div className="auth-form-heading">
            <p className="eyebrow"><span className="auth-heading-dot" /> YOUR COMMUNITY STARTS HERE</p>
            <h1>{mode === 'login' ? 'Welcome back' : 'Join the movement'}<span className="auth-heading-period">.</span></h1>
            <p className="auth-subtitle">
              {mode === 'login'
                ? 'Sign in to continue making a difference.'
                : 'Create your account and start contributing to your community.'}
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <>
                <label className="auth-field">
                  <span>Account type</span>
                  <div>
                    {accountType === 'company' ? <Building2 size={17} /> : <User size={17} />}
                    <select
                      value={accountType}
                      onChange={(event) => setAccountType(event.target.value as AccountType)}
                    >
                      <option value="citizen">Citizen</option>
                      <option value="company">Company / Sponsor</option>
                    </select>
                  </div>
                </label>

                {accountType === 'citizen' ? (
                  <label className="auth-field">
                    <span>Your name</span>
                    <div>
                      <User size={17} />
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Your display name"
                        autoComplete="name"
                        required
                        maxLength={60}
                      />
                    </div>
                  </label>
                ) : (
                  <label className="auth-field">
                    <span>Company name</span>
                    <div>
                      <Building2 size={17} />
                      <input
                        value={companyName}
                        onChange={(event) => setCompanyName(event.target.value)}
                        placeholder="Your business name"
                        autoComplete="organization"
                        required
                        maxLength={100}
                      />
                    </div>
                    <small className="auth-field-help">Your company must be approved before it can publish rewards.</small>
                  </label>
                )}

                <label className="auth-field">
                  <span>Your area</span>
                  <div>
                    <MapPin size={17} />
                    <select
                      value={areaId}
                      onChange={(event) => setAreaId(event.target.value)}
                      required
                      disabled={areasLoading || areas.length === 0}
                      aria-label="Select your area"
                    >
                      <option value="">
                        {areasLoading ? 'Loading areas...' : areas.length === 0 ? 'No areas available' : 'Select your area'}
                      </option>
                      {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                    </select>
                  </div>
                  {!areasLoading && areas.length === 0 && (
                    <small className="auth-field-help">No areas available. Check the areas table and its signed-out read permissions.</small>
                  )}
                </label>
              </>
            )}

            <label className="auth-field">
              <span>Email address</span>
              <div>
                <Mail size={17} />
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
            </label>

            <label className="auth-field">
              <span>Password</span>
              <div>
                <Lock size={17} />
                <input
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </div>
            </label>

            {error && <p className="auth-error" role="alert">{error}</p>}
            {message && <p className="auth-message" role="status">{message}</p>}

            <button
              className="primary-button auth-submit"
              type="submit"
              disabled={loading || (mode === 'signup' && (areasLoading || areas.length === 0))}
            >
              {loading && <LoaderCircle size={17} className="auth-spinner" />}
              <span>
                {loading
                  ? 'Please wait...'
                  : mode === 'login'
                    ? 'Sign in to CivicQuest'
                    : accountType === 'company'
                      ? 'Register company'
                      : 'Create account'}
              </span>
              {!loading && <ArrowRight size={17} />}
            </button>
          </form>

          <p className="auth-switch">
            {mode === 'login' ? 'New to CivicQuest?' : 'Already have an account?'}{' '}
            <button type="button" onClick={switchMode}>
              {mode === 'login' ? 'Create account' : 'Sign in'}
            </button>
          </p>

          <div className="auth-secure-note"><ShieldCheck size={15} /><span>Your account is protected by secure authentication.</span></div>
          <p className="auth-foot">Your good deeds can make a real difference.</p>
        </section>
      </div>
      <p className="auth-copyright">CIVICQUEST <span>•</span> BUILT FOR BETTER COMMUNITIES</p>
    </main>
  )
}
