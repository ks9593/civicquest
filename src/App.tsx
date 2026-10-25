import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Compass,
  Gift,
  Building2,
  Globe2,
  HandHeart,
  Leaf,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import Auth from './Auth'
import { supabase } from './lib/supabase'
import './index.css'

type Page =
  | 'Overview'
  | 'Explore Quests'
  | 'Neighborhoods'
  | 'Rewards'
  | 'Knowledge Hub'
  | 'Submit Proof'
  | 'My Contributions'
  | 'Become an Area Admin'
  | 'Super Admin'
  | 'Company Applications'
  | 'Company Dashboard'
  | 'Reward Approvals'
  | 'Area Admin'

type Quest = {
  id: string
  title: string
  description: string
  category: string
  location: string
  date: string
  points: number
  volunteers: number
  image: string
  color: string
  area_id?: string | null
}


type Contribution = {
  id: string
  quest_id: string
  user_id: string
  evidence_url: string | null
  notes: string | null
  status: string
  created_at: string
}

type QuestRow = {
  id: string
  title: string
  description: string
  category: string
  location_name?: string | null
  area_id?: string | null
}

type Area = { id: string; name: string }
type CompanyApplication = {
  id: string
  user_id: string
  company_name: string
  email: string
  area_id: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}
type SponsorReward = {
  id: string
  company_application_id: string
  title: string
  description: string
  reward_type: 'coupon' | 'discount' | 'voucher' | 'free_item' | 'service'
  reward_value: string
  quantity: number
  area_id: string | null
  quest_id: string | null
  publishing_fee_paise?: number
  payment_status?: 'not_required' | 'pending' | 'paid' | 'failed'
  payment_reference?: string | null
  payment_account_number?: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}
type RewardClaim = {
  id: string
  reward_id: string
  contribution_id: string
  claim_code: string
  status: 'claimed' | 'redeemed'
  created_at: string
}
type QuestRewardView = {
  id: string
  quest_id: string
  reward_id: string
  title: string
  description: string
  reward_type: string
  reward_value: string
  company_name: string
  quantity?: number
  claimed_count?: number
  inventory_status?: 'active' | 'sold_out'
}
type Profile = { role: 'citizen' | 'area_admin' | 'super_admin'; area_id: string | null }
type AdminApplication = {
  id: string
  user_id: string
  applicant_email: string
  area_id: string
  reason: string
  status: string
  created_at: string
  review_notes: string | null
}
type AreaAdminAssignment = { user_id: string; area_id: string | null; email: string | null }
type AreaAdminHistoryEntry = {
  id: string
  user_id: string
  admin_email: string | null
  area_id: string | null
  action: 'assigned' | 'dismissed' | 'reassigned'
  performed_by: string | null
  created_at: string
}

const questImages = [
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=900&q=85',
  'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?auto=format&fit=crop&w=900&q=85',
]


function mapQuest(row: QuestRow, index: number): Quest {
  const category = row.category || 'Community'
  const normalizedCategory = category.toLowerCase()

  return {
    id: row.id,
    title: row.title,
    description: row.description || 'Join your community and make a difference.',
    category,
    location: row.location_name || 'Community initiative',
    date: 'Join anytime',
    points: normalizedCategory.includes('education')
      ? 180
      : normalizedCategory.includes('environment')
        ? 120
        : 100,
    volunteers: 0,
    image: questImages[index % questImages.length],
    area_id: row.area_id || null,
    color: normalizedCategory.includes('education')
      ? 'purple'
      : normalizedCategory.includes('environment')
        ? 'green'
        : 'orange',
  }
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [page, setPage] = useState<Page>('Overview')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [questTitle, setQuestTitle] = useState('')
  const [questDescription, setQuestDescription] = useState('')
  const [questCategory, setQuestCategory] = useState('Environment')
  const [questLocation, setQuestLocation] = useState('')
  const [questXp, setQuestXp] = useState('100')
  const [questCreating, setQuestCreating] = useState(false)
  const [questCreateError, setQuestCreateError] = useState('')
  const [quests, setQuests] = useState<Quest[]>([])
  const [joined, setJoined] = useState<string[]>([])
  const [notice, setNotice] = useState('')
  const [questsLoading, setQuestsLoading] = useState(false)
  const [joiningId, setJoiningId] = useState<string | null>(null)
  const [databaseError, setDatabaseError] = useState('')
  const [contributions, setContributions] = useState<Contribution[]>([])
  const [contributionsLoading, setContributionsLoading] = useState(false)
  const [contributionSubmitting, setContributionSubmitting] = useState(false)
  const [selectedQuestId, setSelectedQuestId] = useState('')
  const [contributionNotes, setContributionNotes] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [contributionError, setContributionError] = useState('')
  const [profile, setProfile] = useState<Profile>({ role: 'citizen', area_id: null })
  const [areas, setAreas] = useState<Area[]>([])
  const [applicationAreaId, setApplicationAreaId] = useState('')
  const [applicationReason, setApplicationReason] = useState('')
  const [applicationStatus, setApplicationStatus] = useState<AdminApplication | null>(null)
  const [applicationSubmitting, setApplicationSubmitting] = useState(false)
  const [applicationError, setApplicationError] = useState('')
  const [applications, setApplications] = useState<AdminApplication[]>([])
  const [applicationsLoading, setApplicationsLoading] = useState(false)
  const [areaAdminAssignments, setAreaAdminAssignments] = useState<AreaAdminAssignment[]>([])
  const [areaAdminAssignmentsLoading, setAreaAdminAssignmentsLoading] = useState(false)
  const [areaAdminAssignmentsError, setAreaAdminAssignmentsError] = useState('')
  const [dismissingAreaAdminId, setDismissingAreaAdminId] = useState<string | null>(null)
  const [areaAdminHistory, setAreaAdminHistory] = useState<AreaAdminHistoryEntry[]>([])
  const [areaAdminHistoryLoading, setAreaAdminHistoryLoading] = useState(false)
  const [areaAdminHistoryError, setAreaAdminHistoryError] = useState('')
  const [reviewingApplicationId, setReviewingApplicationId] = useState<string | null>(null)
  const [reviewNotesById, setReviewNotesById] = useState<Record<string, string>>({})
  const [companyApplications, setCompanyApplications] = useState<CompanyApplication[]>([])
  const [companyApplicationsLoading, setCompanyApplicationsLoading] = useState(false)
  const [reviewingCompanyId, setReviewingCompanyId] = useState<string | null>(null)
  const [companyApplicationError, setCompanyApplicationError] = useState('')
  const [myCompanyApplication, setMyCompanyApplication] = useState<CompanyApplication | null>(null)
  const [, setMyCompanyApplicationLoading] = useState(false)
  const [sponsorRewards, setSponsorRewards] = useState<SponsorReward[]>([])
  const [questRewardViews, setQuestRewardViews] = useState<QuestRewardView[]>([])
  const [rewardClaims, setRewardClaims] = useState<RewardClaim[]>([])
  const [claimingContributionId, setClaimingContributionId] = useState<string | null>(null)
  const [rewardLoading, setRewardLoading] = useState(false)
  const [rewardError, setRewardError] = useState('')
  const [rewardTitle, setRewardTitle] = useState('')
  const [rewardDescription, setRewardDescription] = useState('')
  const [rewardType, setRewardType] = useState<SponsorReward['reward_type']>('coupon')
  const [rewardValue, setRewardValue] = useState('')
  const [rewardQuantity, setRewardQuantity] = useState('100')
  const [rewardQuestId, setRewardQuestId] = useState('')
  const [rewardSubmitting, setRewardSubmitting] = useState(false)
  const [reviewingRewardId, setReviewingRewardId] = useState<string | null>(null)
  const [rewardAccountNumbers, setRewardAccountNumbers] = useState<Record<string, string>>({})
  const [assignQuestId, setAssignQuestId] = useState('')
  const [assignRewardId, setAssignRewardId] = useState('')
  const [adminContributions, setAdminContributions] = useState<Contribution[]>([])
  const [adminContributionsLoading, setAdminContributionsLoading] = useState(false)
  const [reviewingContributionId, setReviewingContributionId] = useState<string | null>(null)

  const notify = useCallback((message: string) => {
    setNotice(message)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Could not restore session:', error.message)
      }

      setSession(data.session)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!notice) return

    const timeout = window.setTimeout(() => setNotice(''), 3500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const loadQuests = useCallback(async () => {
    setQuestsLoading(true)
    setDatabaseError('')

    const { data, error } = await supabase
      .from('quests')
      .select('id, title, description, category, location_name, area_id')
      .order('title', { ascending: true })

    if (error) {
      console.error('Could not load quests:', error.message)
      setDatabaseError(error.message)
      setQuests([])
      setQuestsLoading(false)
      return
    }

    const rows = (data || []) as QuestRow[]
    setQuests(rows.map(mapQuest))
    setQuestsLoading(false)
  }, [])

  const loadJoinedQuests = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('quest_participants')
      .select('quest_id')
      .eq('user_id', userId)

    if (error) {
      console.error('Could not load joined quests:', error.message)
      return
    }

    setJoined((data || []).map((row) => String(row.quest_id)))
  }, [])

  const loadContributions = useCallback(async (userId: string) => {
    setContributionsLoading(true)
    setContributionError('')

    const { data, error } = await supabase
      .from('contributions')
      .select('id, quest_id, user_id, evidence_url, notes, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Could not load contributions:', error.message)
      setContributionError(error.message)
      setContributions([])
    } else {
      setContributions((data || []) as Contribution[])
    }

    setContributionsLoading(false)
  }, [])

  const loadProfileAndAreas = useCallback(async (userId: string) => {
    const [{ data: profileData, error: profileError }, { data: areaData, error: areaError }] = await Promise.all([
      supabase.from('profiles').select('role, area_id').eq('id', userId).maybeSingle(),
      supabase.from('areas').select('id, name').order('name'),
    ])
    if (profileError) console.error('Could not load profile role:', profileError.message)
    if (areaError) console.error('Could not load areas:', areaError.message)
    if (profileData) {
      setProfile({ role: profileData.role || 'citizen', area_id: profileData.area_id || null })
      if (profileData.area_id) setSelectedAreaId(profileData.area_id)
    }
    setAreas((areaData || []) as Area[])
  }, [])

  const loadMyAdminApplication = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('admin_applications')
      .select('id, user_id, applicant_email, area_id, reason, status, created_at, review_notes')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('Could not load admin application:', error.message)
      setApplicationError(error.message)
      return
    }
    setApplicationStatus((data as AdminApplication | null) || null)
    if (data?.area_id) setApplicationAreaId(data.area_id)
  }, [])

  const loadAdminApplications = useCallback(async () => {
    setApplicationsLoading(true)
    const { data, error } = await supabase
      .from('admin_applications')
      .select('id, user_id, applicant_email, area_id, reason, status, created_at, review_notes')
      .in('status', ['pending', 'under_review'])
      .order('created_at', { ascending: true })
    if (error) {
      setApplicationError(error.message)
      setApplications([])
    } else {
      setApplications((data || []) as AdminApplication[])
      setApplicationError('')
    }
    setApplicationsLoading(false)
  }, [])

  const loadAreaAdminAssignments = useCallback(async () => {
    setAreaAdminAssignmentsLoading(true)
    setAreaAdminAssignmentsError('')

    const [{ data: profiles, error: profilesError }, { data: approvedApps, error: appsError }] = await Promise.all([
      supabase.from('profiles').select('id, role, area_id').eq('role', 'area_admin'),
      supabase.from('admin_applications').select('user_id, applicant_email, area_id').eq('status', 'approved'),
    ])

    if (profilesError) {
      setAreaAdminAssignmentsError(profilesError.message)
      setAreaAdminAssignments([])
      setAreaAdminAssignmentsLoading(false)
      return
    }
    if (appsError) {
      setAreaAdminAssignmentsError(appsError.message)
      setAreaAdminAssignments([])
      setAreaAdminAssignmentsLoading(false)
      return
    }

    const emailByUserId = new Map<string, string>()
    for (const app of approvedApps || []) {
      if (app.user_id && app.applicant_email) emailByUserId.set(app.user_id, app.applicant_email)
    }
    setAreaAdminAssignments((profiles || []).map((row: { id: string; role: string; area_id: string | null }) => ({
      user_id: row.id,
      area_id: row.area_id,
      email: emailByUserId.get(row.id) || null,
    })))
    setAreaAdminAssignmentsLoading(false)
  }, [])

  const loadAreaAdminHistory = useCallback(async () => {
    setAreaAdminHistoryLoading(true)
    setAreaAdminHistoryError('')
    const { data, error } = await supabase
      .from('area_admin_history')
      .select('id, user_id, admin_email, area_id, action, performed_by, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      setAreaAdminHistoryError(error.message)
      setAreaAdminHistory([])
    } else {
      setAreaAdminHistory((data || []) as AreaAdminHistoryEntry[])
    }
    setAreaAdminHistoryLoading(false)
  }, [])

  const loadMyCompanyApplication = useCallback(async (userId: string) => {
    setMyCompanyApplicationLoading(true)
    const { data, error } = await supabase
      .from('company_applications')
      .select('id, user_id, company_name, email, area_id, status, created_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('Could not load company application:', error.message)
      setMyCompanyApplication(null)
    } else {
      setMyCompanyApplication((data as CompanyApplication | null) || null)
    }
    setMyCompanyApplicationLoading(false)
  }, [])

  const loadCompanyApplications = useCallback(async () => {
    setCompanyApplicationsLoading(true)
    setCompanyApplicationError('')
    const { data, error } = await supabase
      .from('company_applications')
      .select('id, user_id, company_name, email, area_id, status, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setCompanyApplicationError(error.message)
      setCompanyApplications([])
    } else {
      setCompanyApplications((data || []) as CompanyApplication[])
    }
    setCompanyApplicationsLoading(false)
  }, [])

  const reviewCompanyApplication = async (
    application: CompanyApplication,
    decision: 'approved' | 'rejected',
  ) => {
    setReviewingCompanyId(application.id)
    setCompanyApplicationError('')

    const { error } = await supabase
      .from('company_applications')
      .update({ status: decision })
      .eq('id', application.id)
      .eq('status', 'pending')

    setReviewingCompanyId(null)

    if (error) {
      setCompanyApplicationError(error.message)
      return
    }

    notify(
      decision === 'approved'
        ? `${application.company_name} approved. Company dashboard publishing still needs to be enabled.`
        : `${application.company_name} application rejected.`,
    )
    await loadCompanyApplications()
  }

  const loadSponsorRewards = useCallback(async () => {
    setRewardLoading(true)
    setRewardError('')
    const { data, error } = await supabase
      .from('sponsor_rewards')
      .select('id, company_application_id, title, description, reward_type, reward_value, quantity, area_id, quest_id, payment_account_number, payment_status, payment_reference, status, created_at')
      .order('created_at', { ascending: false })
    if (error) {
      setRewardError(error.message)
      setSponsorRewards([])
    } else {
      setSponsorRewards((data || []) as SponsorReward[])
    }
    setRewardLoading(false)
  }, [])

  const loadQuestRewardViews = useCallback(async () => {
    // Read directly from approved sponsor offers. This avoids depending on
    // quest_rewards being populated by the approval trigger or nested RLS joins.
    const { data, error } = await supabase
      .from('sponsor_rewards')
      .select('id, company_application_id, quest_id, title, description, reward_type, reward_value, quantity, inventory_status, status')
      .eq('status', 'approved')
      .not('quest_id', 'is', null)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Could not load approved sponsor rewards:', error.message)
      setQuestRewardViews([])
      return
    }

    const offers = (data || []) as Array<{
      id: string
      company_application_id: string
      quest_id: string
      title: string
      description: string
      reward_type: string
      reward_value: string
      quantity: number
      inventory_status?: 'active' | 'sold_out'
      status: string
    }>

    const companyIds = [...new Set(offers.map((offer) => offer.company_application_id))]
    let companyNames = new Map<string, string>()

    if (companyIds.length > 0) {
      const { data: companies, error: companyError } = await supabase
        .from('company_applications')
        .select('id, company_name')
        .in('id', companyIds)

      if (companyError) {
        console.error('Could not load sponsor company names:', companyError.message)
      } else {
        companyNames = new Map((companies || []).map((company: { id: string; company_name: string }) => [
          company.id,
          company.company_name,
        ]))
      }
    }

    const offerIds = offers.map((offer) => offer.id)
    let claimCounts = new Map<string, number>()
    if (offerIds.length > 0) {
      const { data: claims, error: claimsError } = await supabase
        .from('sponsor_reward_claims')
        .select('reward_id')
        .in('reward_id', offerIds)
      if (claimsError) {
        console.error('Could not load coupon claim counts:', claimsError.message)
      } else {
        claimCounts = new Map<string, number>()
        for (const claim of claims || []) {
          claimCounts.set(claim.reward_id, (claimCounts.get(claim.reward_id) || 0) + 1)
        }
      }
    }

    setQuestRewardViews(offers.map((offer) => ({
      id: offer.id,
      quest_id: offer.quest_id,
      reward_id: offer.id,
      title: offer.title,
      description: offer.description,
      reward_type: offer.reward_type,
      reward_value: offer.reward_value,
      company_name: companyNames.get(offer.company_application_id) || 'Community partner',
      quantity: offer.quantity,
      claimed_count: claimCounts.get(offer.id) || 0,
      inventory_status: (claimCounts.get(offer.id) || 0) >= offer.quantity
        ? 'sold_out'
        : (offer.inventory_status || 'active'),
    })))
  }, [])

  const submitSponsorReward = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!myCompanyApplication || myCompanyApplication.status !== 'approved') return
    setRewardSubmitting(true)
    setRewardError('')
    const { error } = await supabase.from('sponsor_rewards').insert({
      company_application_id: myCompanyApplication.id,
      title: rewardTitle.trim(),
      description: rewardDescription.trim(),
      reward_type: rewardType,
      reward_value: rewardValue.trim(),
      quantity: Number(rewardQuantity),
      area_id: myCompanyApplication.area_id,
      quest_id: rewardQuestId,
      status: 'pending',
    })
    setRewardSubmitting(false)
    if (error) {
      setRewardError(error.message)
      return
    }
    setRewardTitle('')
    setRewardDescription('')
    setRewardValue('')
    setRewardQuantity('100')
    setRewardQuestId('')
    notify('Reward submitted for Super Admin approval for the selected quest.')
    await loadSponsorRewards()
  }

  const reviewSponsorReward = async (reward: SponsorReward, decision: 'approved' | 'rejected') => {
    const accountNumber = (rewardAccountNumbers[reward.id] || '').trim()
    if (decision === 'approved' && !accountNumber) {
      setRewardError('Enter the account number before approving this reward.')
      return
    }
    setReviewingRewardId(reward.id)
    setRewardError('')
    const { error } = await supabase.from('sponsor_rewards')
      .update({
        status: decision,
        ...(decision === 'approved' ? { payment_account_number: accountNumber, payment_status: 'pending' } : {}),
      })
      .eq('id', reward.id)
      .eq('status', 'pending')
    setReviewingRewardId(null)
    if (error) {
      setRewardError(error.message)
      return
    }
    notify(decision === 'approved' ? 'Reward approved.' : 'Reward rejected.')
    await loadSponsorRewards()
  }

  const assignRewardToQuest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!assignQuestId || !assignRewardId) return
    const { error } = await supabase.from('quest_rewards').insert({
      quest_id: assignQuestId,
      reward_id: assignRewardId,
      assigned_by: session?.user.id,
    })
    if (error) {
      setRewardError(error.message)
      return
    }
    setRewardError('')
    notify('Reward attached to quest. Citizens can now see it.')
    await Promise.all([loadQuestRewardViews(), loadSponsorRewards()])
  }

  const loadAreaContributions = useCallback(async () => {
    setAdminContributionsLoading(true)
    const { data, error } = await supabase
      .from('contributions')
      .select('id, quest_id, user_id, evidence_url, notes, status, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (error) {
      setContributionError(error.message)
      setAdminContributions([])
    } else {
      setAdminContributions((data || []) as Contribution[])
      setContributionError('')
    }
    setAdminContributionsLoading(false)
  }, [])

  const handleApplyForAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setApplicationError('')
    if (!session?.user.email) {
      setApplicationError('Your signed-in account must have an email address.')
      return
    }
    if (!applicationAreaId) {
      setApplicationError('Choose the area you want to manage.')
      return
    }
    if (applicationReason.trim().length < 20) {
      setApplicationError('Please write at least 20 characters about why you want to become an area admin.')
      return
    }
    setApplicationSubmitting(true)
    const { error } = await supabase.from('admin_applications').insert({
      user_id: session.user.id,
      applicant_email: session.user.email,
      area_id: applicationAreaId,
      reason: applicationReason.trim(),
      status: 'pending',
    })
    setApplicationSubmitting(false)
    if (error) {
      setApplicationError(error.code === '23505'
        ? 'You already have an application awaiting a decision.'
        : error.message)
      return
    }
    setApplicationReason('')
    notify('Your area admin application has been submitted.')
    await loadMyAdminApplication(session.user.id)
  }

  const dismissAreaAdmin = async (assignment: AreaAdminAssignment) => {
    const areaName = areas.find((area) => area.id === assignment.area_id)?.name || 'this area'
    const adminEmail = assignment.email || assignment.user_id
    const confirmed = window.confirm(
      `Dismiss ${adminEmail} as Area Admin for ${areaName}? Their account and historical records will remain, but their Area Admin access will be removed. Super Admin will manage this area until another admin is assigned.`,
    )
    if (!confirmed) return

    setDismissingAreaAdminId(assignment.user_id)
    setAreaAdminAssignmentsError('')
    const { error } = await supabase.rpc('dismiss_area_admin', {
      p_user_id: assignment.user_id,
    })
    setDismissingAreaAdminId(null)

    if (error) {
      setAreaAdminAssignmentsError(error.message)
      return
    }

    notify(`${adminEmail} was dismissed as Area Admin. ${areaName} is now managed by Super Admin.`)
    await Promise.all([loadAreaAdminAssignments(), loadAdminApplications()])
  }

  const reviewApplication = async (application: AdminApplication, decision: 'approved' | 'rejected' | 'under_review') => {
    if (decision === 'approved' && areaAdminAssignmentsLoading) {
      setApplicationError('Please wait for current area-admin assignments to finish loading, then try again.')
      return
    }
    if (decision === 'approved') {
      const existingAdmin = areaAdminAssignments.find((assignment) => assignment.area_id === application.area_id && assignment.user_id !== application.user_id)
      if (existingAdmin) {
        const areaName = areas.find((area) => area.id === application.area_id)?.name || 'This area'
        setApplicationError(`${areaName} already has an Area Admin. One area can have only one assigned Area Admin. Reassign the current admin before approving another applicant.`)
        return
      }
    }
    setReviewingApplicationId(application.id)
    setApplicationError('')
    const { error } = await supabase.rpc('review_admin_application', {
      p_application_id: application.id,
      p_decision: decision,
      p_review_notes: reviewNotesById[application.id]?.trim() || null,
    })
    setReviewingApplicationId(null)
    if (error) {
      setApplicationError(error.message)
      return
    }
    notify(decision === 'approved' ? 'Applicant approved and assigned to the selected area.' : decision === 'rejected' ? 'Application rejected.' : 'Application moved to under review.')
    await Promise.all([loadAdminApplications(), loadAreaAdminAssignments()])
  }

  const handleCreateQuest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setQuestCreateError('')
    if (!session) return
    const targetAreaId = profile.role === 'super_admin' ? selectedAreaId : profile.area_id
    if (!targetAreaId) {
      setQuestCreateError('Your account must have an assigned area before creating a quest.')
      return
    }
    if (profile.role !== 'area_admin' && profile.role !== 'super_admin') {
      setQuestCreateError('Only an approved admin can create quests.')
      return
    }
    setQuestCreating(true)
    const { error } = await supabase.from('quests').insert({
      title: questTitle.trim(),
      description: questDescription.trim(),
      category: questCategory,
      location_name: questLocation.trim(),
      xp_reward: Number(questXp),
      area_id: targetAreaId,
      created_by: session.user.id,
      status: 'open',
    })
    setQuestCreating(false)
    if (error) {
      setQuestCreateError(error.message)
      return
    }
    setQuestTitle('')
    setQuestDescription('')
    setQuestLocation('')
    setQuestXp('100')
    notify('Quest created successfully.')
    await loadQuests()
  }

  const claimRewardForContribution = async (contribution: Contribution) => {
    if (!session) return
    setClaimingContributionId(contribution.id)
    setContributionError('')
    const { data, error } = await supabase.rpc('claim_reward_for_contribution', {
      p_contribution_id: contribution.id,
    })
    setClaimingContributionId(null)
    if (error) {
      setContributionError(error.message)
      return
    }
    const result = (data || {}) as { claim_code?: string; reward_title?: string; message?: string }
    if (result.claim_code) {
      notify(`Reward claimed: ${result.reward_title || 'Coupon'}. Your code: ${result.claim_code}`)
      const { data: claims } = await supabase.from('sponsor_reward_claims')
        .select('id, reward_id, contribution_id, claim_code, status, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      setRewardClaims((claims || []) as RewardClaim[])
      await loadQuestRewardViews()
    } else {
      notify(result.message || 'Reward could not be claimed.')
    }
  }

  const reviewContribution = async (contribution: Contribution, decision: 'approved' | 'rejected') => {
    if (!session) return
    setReviewingContributionId(contribution.id)
    const { error } = await supabase
      .from('contributions')
      .update({ status: decision, reviewed_by: session.user.id, reviewed_at: new Date().toISOString() })
      .eq('id', contribution.id)
      .eq('status', 'pending')
    setReviewingContributionId(null)
    if (error) {
      setContributionError(error.message)
      return
    }
    notify(`Contribution ${decision}.`)
    await loadAreaContributions()
  }

  useEffect(() => {
    if (!session) return

    void loadProfileAndAreas(session.user.id)
    void loadMyAdminApplication(session.user.id)
    void loadMyCompanyApplication(session.user.id)
    void loadQuests()
    void loadJoinedQuests(session.user.id)
    void loadContributions(session.user.id)
    void supabase.from('sponsor_reward_claims')
      .select('id, reward_id, contribution_id, claim_code, status, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setRewardClaims((data || []) as RewardClaim[]))
  }, [session, loadQuests, loadJoinedQuests, loadContributions, loadProfileAndAreas, loadMyAdminApplication, loadMyCompanyApplication])

  useEffect(() => {
    if (!session) return
    if (profile.role === 'super_admin') {
      void loadAdminApplications()
      void loadAreaAdminAssignments()
      void loadCompanyApplications()
    }
    if (profile.role === 'area_admin' || profile.role === 'super_admin') void loadAreaContributions()
  }, [session, profile.role, loadAdminApplications, loadAreaAdminAssignments, loadAreaAdminHistory, loadCompanyApplications, loadAreaContributions])

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      notify(error.message)
      return
    }

    setJoined([])
    setPage('Overview')
    notify('You have signed out successfully.')
  }

  const handleJoin = async (quest: Quest) => {
    if (!session) {
      notify('Please sign in first.')
      return
    }

    if (quest.id.startsWith('demo-')) {
      notify('Demo quests cannot be saved. Reload your database quests.')
      return
    }

    if (joined.includes(quest.id)) {
      notify('You have already joined this quest.')
      return
    }

    setJoiningId(quest.id)

    const { error } = await supabase
      .from('quest_participants')
      .insert({
        quest_id: quest.id,
        user_id: session.user.id,
      })

    setJoiningId(null)

    if (error) {
      console.error('Could not join quest:', error.message)

      if (error.code === '23505') {
        setJoined((current) =>
          current.includes(quest.id) ? current : [...current, quest.id],
        )
        notify('You have already joined this quest.')
      } else {
        notify(`Could not join quest: ${error.message}`)
      }

      return
    }

    setJoined((current) => [...current, quest.id])
    notify(`You joined "${quest.title}"!`)
  }

  const handleSubmitContribution = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setContributionError('')

    if (!session) {
      notify('Please sign in first.')
      return
    }

    if (!selectedQuestId || !joined.includes(selectedQuestId)) {
      setContributionError('Choose a quest you have already joined.')
      return
    }

    if (!contributionNotes.trim()) {
      setContributionError('Please describe your contribution.')
      return
    }

    if (evidenceUrl.trim()) {
      try {
        const parsedUrl = new URL(evidenceUrl.trim())
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
          throw new Error('Invalid protocol')
        }
      } catch {
        setContributionError('Enter a valid http or https evidence URL, or leave it blank.')
        return
      }
    }

    setContributionSubmitting(true)

    const { error } = await supabase.from('contributions').insert({
      quest_id: selectedQuestId,
      user_id: session.user.id,
      evidence_url: evidenceUrl.trim() || null,
      notes: contributionNotes.trim(),
      status: 'pending',
    })

    setContributionSubmitting(false)

    if (error) {
      console.error('Could not submit contribution:', error.message)
      setContributionError(error.message)
      return
    }

    setContributionNotes('')
    setEvidenceUrl('')
    notify('Proof submitted successfully and is pending review.')
    setPage('My Contributions')
    await loadContributions(session.user.id)
  }

  useEffect(() => {
    if (!session?.user?.id) return
    void loadSponsorRewards()
    void loadQuestRewardViews()
  }, [session?.user?.id, loadSponsorRewards, loadQuestRewardViews])

  const effectiveAreaId = profile.role === 'area_admin' ? profile.area_id : selectedAreaId

  // Keep one shared active-quest list so the sidebar count and quest cards agree.
  // Sold-out sponsored quests are hidden from active listings but remain in the database.
  const activeQuests = quests.filter((quest) => {
    const rewardsForQuest = questRewardViews.filter((reward) => reward.quest_id === quest.id)
    const questIsSoldOut = rewardsForQuest.length > 0 && rewardsForQuest.every(
      (reward) => reward.inventory_status === 'sold_out' ||
        (reward.quantity || 0) - (reward.claimed_count || 0) <= 0,
    )
    return !questIsSoldOut
  })

  const filteredQuests = activeQuests.filter((quest) => {
    const query = search.toLowerCase()
    const areaMatches = !effectiveAreaId || (quest as Quest & { area_id?: string | null }).area_id === effectiveAreaId

    return areaMatches && (
      quest.title.toLowerCase().includes(query) ||
      quest.category.toLowerCase().includes(query) ||
      quest.location.toLowerCase().includes(query) ||
      quest.description.toLowerCase().includes(query)
    )
  })

  if (authLoading) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <HandHeart size={28} />
          </div>
          <h2>Loading CivicQuest...</h2>
          <p>Please wait while we check your session.</p>
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <Auth
        onAuthenticated={() => {
          supabase.auth.getSession().then(({ data }) => {
            setSession(data.session)
          })
        }}
      />
    )
  }

  const displayName =
    session.user.user_metadata?.display_name ||
    session.user.user_metadata?.full_name ||
    session.user.email?.split('@')[0] ||
    'Volunteer'

  const firstName = displayName.split(' ')[0]
  const assignedAreaName = areas.find((area) => area.id === profile.area_id)?.name || 'your assigned area'

  const refreshQuestsButton = (
    <button
      className="text-button"
      onClick={() => void loadQuests()}
      disabled={questsLoading}
    >
      {questsLoading ? 'Refreshing...' : 'Refresh quests'}
    </button>
  )

  return (
    <div className="app-shell">
      <style>{`
        :root { --cq-ink: #182338; --cq-muted: #69758a; --cq-brand: #6558e8; --cq-brand-dark: #5144d4; --cq-mint: #dff8ed; --cq-border: #e7eaf2; }
        body { background: #f5f7fc; color: var(--cq-ink); }
        .app-shell { min-height: 100vh; background: radial-gradient(ellipse at 70% -15%, rgba(112, 100, 245, .12), transparent 42%), #f6f8fc; }
        .sidebar { background: linear-gradient(180deg, #171d35 0%, #202947 100%) !important; color: #f8faff; box-shadow: 8px 0 32px rgba(24,35,56,.10); border-right: 1px solid rgba(255,255,255,.08); }
        .brand { padding-bottom: 28px !important; }
        .brand-icon { background: linear-gradient(135deg, #8578ff, #5b4bdc) !important; box-shadow: 0 8px 24px rgba(101,88,232,.35); border-radius: 15px !important; }
        .brand h1 { color: #fff !important; letter-spacing: -.04em; }
        .brand p, .sidebar-label { color: #aab4d0 !important; }
        .sidebar-nav { gap: 7px !important; }
        .nav-item { border-radius: 12px !important; transition: background .2s ease, transform .2s ease, color .2s ease; }
        .nav-item:hover { background: rgba(255,255,255,.09) !important; transform: translateX(2px); }
        .nav-item.active { background: linear-gradient(100deg, rgba(124,111,255,.30), rgba(124,111,255,.12)) !important; color: #fff !important; box-shadow: inset 3px 0 #9d93ff; }
        .nav-count { background: #8c80ff !important; color: #fff !important; border-radius: 999px !important; font-weight: 800; }
        .community-card, .sidebar-tip { border: 1px solid rgba(255,255,255,.09) !important; background: rgba(255,255,255,.055) !important; border-radius: 16px !important; }
        .sidebar-status { color: #b6c3df !important; }
        .status-dot { box-shadow: 0 0 0 4px rgba(74,222,128,.12); }
        .main-content { min-width: 0; }
        .topbar { background: rgba(255,255,255,.82) !important; backdrop-filter: blur(18px); border-bottom: 1px solid rgba(224,229,241,.85) !important; }
        .breadcrumb strong { color: #252c47 !important; }
        .search-box { border: 1px solid #e5e8f2 !important; background: #f8f9fd !important; border-radius: 14px !important; transition: box-shadow .2s ease, border-color .2s ease; }
        .search-box:focus-within { border-color: #aaa2ff !important; box-shadow: 0 0 0 4px rgba(101,88,232,.09); }
        .icon-button, .menu-toggle { border-radius: 12px !important; transition: transform .2s ease, background .2s ease; }
        .icon-button:hover { transform: translateY(-1px); background: #efedff !important; }
        .page-container { max-width: 1440px; }
        .welcome-section { padding: clamp(24px, 4vw, 42px) !important; border-radius: 26px !important; background: linear-gradient(120deg, #fff 0%, #f1f0ff 58%, #eafaf3 100%) !important; border: 1px solid #e8e7fa; box-shadow: 0 14px 45px rgba(50,54,100,.06); overflow: hidden; position: relative; }
        .welcome-section:after { content: ''; position: absolute; width: 240px; height: 240px; right: -65px; top: -95px; border-radius: 50%; background: radial-gradient(circle, rgba(126,113,255,.18), rgba(126,113,255,0)); pointer-events: none; }
        .welcome-section h2 { letter-spacing: -.045em; color: #202744 !important; }
        .eyebrow { letter-spacing: .13em !important; font-weight: 800 !important; }
        .primary-button, .featured-button { background: linear-gradient(135deg, #7669f2, #5949d6) !important; color: white !important; border: 0 !important; border-radius: 13px !important; box-shadow: 0 8px 18px rgba(101,88,232,.22); transition: transform .2s ease, box-shadow .2s ease, filter .2s ease; }
        .primary-button:hover:not(:disabled), .featured-button:hover { transform: translateY(-2px); box-shadow: 0 12px 25px rgba(101,88,232,.30); filter: saturate(1.08); }
        .primary-button:disabled { opacity: .58; box-shadow: none; }
        .text-button { border-radius: 10px !important; transition: background .2s ease; }
        .text-button:hover { background: #efedff !important; }
        .stats-grid { gap: 18px !important; }
        .stat-card { border: 1px solid rgba(229,233,243,.95) !important; border-radius: 20px !important; background: rgba(255,255,255,.94) !important; box-shadow: 0 8px 25px rgba(35,45,78,.035); transition: transform .2s ease, box-shadow .2s ease; }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 14px 30px rgba(35,45,78,.08); }
        .stat-value { letter-spacing: -.05em; color: #242b48 !important; }
        .stat-icon { border-radius: 14px !important; }
        .featured-banner { border-radius: 24px !important; overflow: hidden; box-shadow: 0 15px 34px rgba(46,58,97,.10); }
        .section-block, .panel { border-radius: 20px; }
        .section-heading h2, .section-heading h3 { letter-spacing: -.035em; color: #222944; }
        .quest-grid { gap: 22px !important; }
        .quest-card { border: 1px solid #e6eaf3 !important; border-radius: 20px !important; overflow: hidden; background: #fff !important; box-shadow: 0 8px 24px rgba(30,42,74,.045); transition: transform .24s ease, box-shadow .24s ease, border-color .24s ease; }
        .quest-card:hover { transform: translateY(-5px); box-shadow: 0 18px 38px rgba(30,42,74,.12); border-color: #d8d3ff !important; }
        .quest-image-wrap { overflow: hidden; }
        .quest-image { transition: transform .45s ease; }
        .quest-card:hover .quest-image { transform: scale(1.045); }
        .quest-category { border-radius: 999px !important; box-shadow: 0 4px 12px rgba(20,25,45,.10); font-weight: 750 !important; }
        .quest-card-content { padding: 22px !important; }
        .quest-card-content h4 { color: #222944 !important; letter-spacing: -.025em; }
        .quest-description { color: #667189 !important; line-height: 1.65 !important; }
        .quest-meta { color: #6d7890 !important; }
        .quest-card-footer { border-top: 1px solid #eef0f6; padding-top: 16px; margin-top: 18px; }
        .quest-points { color: #5e52d6 !important; }
        .join-button { border-radius: 11px !important; transition: transform .2s ease, box-shadow .2s ease; }
        .join-button:not(:disabled) { box-shadow: 0 5px 13px rgba(101,88,232,.14); }
        .join-button:not(:disabled):hover { transform: translateY(-1px); }
        .panel, .feature-panel { border: 1px solid #e7eaf3 !important; box-shadow: 0 8px 24px rgba(30,42,74,.04); background: #fff; }
        input, select, textarea { border-radius: 11px !important; }
        input:focus, select:focus, textarea:focus { outline: none; border-color: #a59cff !important; box-shadow: 0 0 0 4px rgba(101,88,232,.09) !important; }
        .contribution-item { border-radius: 18px !important; }
        .empty-state, .empty-activity { border: 1px dashed #d9deec; border-radius: 20px !important; background: rgba(255,255,255,.72); }
        .toast { border: 1px solid rgba(255,255,255,.7); border-radius: 16px !important; box-shadow: 0 18px 48px rgba(20,30,55,.18); backdrop-filter: blur(18px); }
        .page-footer { color: #8490a5 !important; }
        @media (max-width: 760px) {
          .welcome-section { padding: 24px !important; border-radius: 20px !important; }
          .stats-grid { gap: 12px !important; }
          .quest-grid { gap: 16px !important; }
          .quest-card-content { padding: 18px !important; }
          .topbar { gap: 10px; }
          .search-box kbd { display: none; }
        }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; } }
      `}</style>
      {mobileMenu && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileMenu(false)}
        />
      )}

      <aside
        className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}
        style={{
          height: '100dvh',
          maxHeight: '100dvh',
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div className="brand">
          <div className="brand-icon">
            <HandHeart size={25} />
          </div>
          <div>
            <h1>CivicQuest</h1>
            <p>Make impact together</p>
          </div>
          <button
            className="mobile-close"
            aria-label="Close menu"
            onClick={() => setMobileMenu(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="sidebar-label">WORKSPACE</div>

        <nav className="sidebar-nav">
          {[
            { label: 'Overview' as Page, icon: Activity },
            { label: 'Explore Quests' as Page, icon: Compass },
            { label: 'Neighborhoods' as Page, icon: Globe2 },
            { label: 'Rewards' as Page, icon: Gift },
            { label: 'Knowledge Hub' as Page, icon: BookOpen },
            { label: 'Submit Proof' as Page, icon: ShieldCheck },
            { label: 'My Contributions' as Page, icon: CheckCircle2 },
            ...(profile.role === 'citizen' ? [{ label: 'Become an Area Admin' as Page, icon: ShieldCheck }] : []),
            ...(myCompanyApplication?.status === 'approved' ? [{ label: 'Company Dashboard' as Page, icon: Building2 }] : []),
            ...(profile.role === 'super_admin' ? [{ label: 'Super Admin' as Page, icon: ShieldCheck }, { label: 'Company Applications' as Page, icon: Building2 }, { label: 'Reward Approvals' as Page, icon: Gift }] : []),
            ...(profile.role === 'area_admin' || profile.role === 'super_admin' ? [{ label: 'Area Admin' as Page, icon: CheckCircle2 }] : []),
          ].map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${page === label ? 'active' : ''}`}
              onClick={() => {
                setPage(label)
                setMobileMenu(false)
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === 'Explore Quests' && (
                <span className="nav-count">{activeQuests.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-label community-label">YOUR COMMUNITY</div>

        <div className="community-card">
          <div className="community-icon">
            <Users size={20} />
          </div>
          <div>
            <strong>Local Heroes</strong>
            <span>Growing together</span>
          </div>
          <ArrowRight size={16} />
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-icon">
              <Sparkles size={18} />
            </div>
            <strong>Small acts, big impact.</strong>
            <p>Every contribution helps build a better community.</p>
          </div>

          <button
            className="nav-item"
            onClick={() =>
              notify('Account settings will be available in a future update.')
            }
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>

          <button className="nav-item" onClick={() => void handleSignOut()}>
            <LogOut size={18} />
            <span>Sign out</span>
          </button>

          <div className="sidebar-status">
            <span className="status-dot" />
            <span>Connected to CivicQuest</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-toggle"
              aria-label="Open navigation"
              onClick={() => setMobileMenu(true)}
            >
              <Menu size={22} />
            </button>

            <div className="breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-divider">/</span>
              <strong>{page}</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <label className="search-box">
              <Search size={17} />
              <input
                type="search"
                placeholder="Search quests..."
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  if (event.target.value) setPage('Explore Quests')
                }}
              />
              <kbd>Ctrl K</kbd>
            </label>

            <button
              className="icon-button"
              aria-label="Community messages"
              onClick={() => notify('Community messaging is coming soon.')}
            >
              <MessageCircle size={19} />
            </button>

            <div className="user-avatar" title={session.user.email || displayName}>
              {firstName.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="page-container">
          {page === 'Overview' && (
            <>
              <section className="welcome-section">
                <div>
                  <div className="eyebrow">
                    <Sparkles size={14} />
                    YOUR COMMUNITY, YOUR IMPACT
                  </div>
                  <h2>
                    Welcome back, {firstName}
                    <span className="welcome-wave">!</span>
                  </h2>
                  <p>
                    Every small action creates a ripple. Ready to make a
                    difference today?
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => setPage('Explore Quests')}
                >
                  <Plus size={18} />
                  Explore quests
                </button>
              </section>

              <section className="stats-grid">
                <StatCard
                  icon={<Target size={21} />}
                  iconClass="stat-green"
                  trend="Your journey"
                  value={joined.length}
                  label="Quests joined"
                  foot="Your saved participation"
                />
                <StatCard
                  icon={<Zap size={21} />}
                  iconClass="stat-purple"
                  trend="Keep going"
                  value={joined.reduce((sum, id) => {
                    const quest = quests.find((item) => item.id === id)
                    return sum + (quest?.points || 0)
                  }, 0)}
                  label="Impact points"
                  foot="Estimated quest points"
                />
                <StatCard
                  icon={<HandHeart size={21} />}
                  iconClass="stat-orange"
                  trend="Together"
                  value={filteredQuests.length}
                  label="Available quests"
                  foot="Loaded from Supabase"
                />
                <StatCard
                  icon={<Trophy size={21} />}
                  iconClass="stat-blue"
                  trend="Your potential"
                  value={joined.length === 0 ? 'New' : 'Rising'}
                  label="Volunteer status"
                  foot="Build your civic reputation"
                />
              </section>

              <section className="featured-banner">
                <div className="featured-content">
                  <div className="featured-tag">
                    <Leaf size={14} />
                    THIS WEEK'S SPOTLIGHT
                  </div>
                  <h3>Little actions. Lasting change.</h3>
                  <p>
                    Join your neighbors in creating cleaner, greener, more
                    connected communities.
                  </p>
                  <button
                    className="featured-button"
                    onClick={() => setPage('Explore Quests')}
                  >
                    Find your next quest <ArrowRight size={17} />
                  </button>
                </div>

                <div className="featured-art" aria-hidden="true">
                  <div className="art-circle art-circle-one" />
                  <div className="art-circle art-circle-two" />
                  <div className="art-emoji">🌱</div>
                  <div className="art-sparkle">
                    <Sparkles size={25} />
                  </div>
                </div>
              </section>

              <section className="section-block">
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">MAKE A DIFFERENCE</div>
                    <h3>Quests for you</h3>
                    <p>Real quest records loaded from your database.</p>
                  </div>
                  {refreshQuestsButton}
                </div>

                {databaseError && (
                  <ErrorNotice
                    message={databaseError}
                    onRetry={() => void loadQuests()}
                  />
                )}

                {questsLoading ? (
                  <LoadingNotice message="Loading quests from Supabase..." />
                ) : quests.length === 0 ? (
                  <EmptyNotice
                    title="No quests found"
                    message="Add quests in Supabase, then refresh."
                    onRetry={() => void loadQuests()}
                  />
                ) : (
                  <div className="quest-grid">
                    {filteredQuests.slice(0, 3).map((quest) => (
                      <QuestCard
                        key={quest.id}
                        quest={quest}
                        joined={joined.includes(quest.id)}
                        joining={joiningId === quest.id}
                        onJoin={() => void handleJoin(quest)}
                        sponsoredReward={questRewardViews.find((reward) => reward.quest_id === quest.id)}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section className="bottom-grid">
                <div className="panel leaderboard-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Community champions</h3>
                      <p>Leaderboard preview</p>
                    </div>
                    <Trophy size={21} />
                  </div>

                  <div className="empty-activity">
                    <div className="empty-activity-icon">
                      <ShieldCheck size={24} />
                    </div>
                    <strong>Verified reputation is next</strong>
                    <p>
                      The leaderboard will use verified contributions after
                      that feature is connected.
                    </p>
                  </div>
                </div>

                <div className="panel activity-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Your journey</h3>
                      <p>Quests you've joined</p>
                    </div>
                    <Activity size={21} />
                  </div>

                  {joined.length === 0 ? (
                    <div className="empty-activity">
                      <div className="empty-activity-icon">
                        <HandHeart size={24} />
                      </div>
                      <strong>Your story starts here</strong>
                      <p>
                        Join a quest and your saved participation will appear
                        here.
                      </p>
                      <button
                        className="text-button"
                        onClick={() => setPage('Explore Quests')}
                      >
                        Discover quests <ArrowRight size={15} />
                      </button>
                    </div>
                  ) : (
                    joined.map((id) => {
                      const quest = quests.find((item) => item.id === id)

                      if (!quest) return null

                      return (
                        <div className="activity-row" key={id}>
                          <div className="activity-check">
                            <CheckCircle2 size={19} />
                          </div>
                          <div>
                            <strong>Joined a quest</strong>
                            <p>{quest.title}</p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </section>
            </>
          )}

          {page === 'Explore Quests' && (
            <section className="section-block page-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">YOUR NEXT ADVENTURE</div>
                  <h2>Explore community quests</h2>
                  <p>Find a cause you care about and take your first step.</p>
                  <label className="contribution-field" style={{ maxWidth: 360, marginTop: 14 }}>
                    <span>Choose area</span>
                    <select
                      value={profile.role === 'area_admin' ? (profile.area_id || '') : selectedAreaId}
                      disabled={profile.role === 'area_admin'}
                      onChange={(event) => setSelectedAreaId(event.target.value)}
                    >
                      <option value="">All areas</option>
                      {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                    </select>
                  </label>
                </div>
                {refreshQuestsButton}
              </div>

              {databaseError && (
                <ErrorNotice
                  message={databaseError}
                  onRetry={() => void loadQuests()}
                />
              )}

              {questsLoading ? (
                <LoadingNotice message="Loading quests from Supabase..." />
              ) : filteredQuests.length === 0 ? (
                <EmptyNotice
                  title={search ? 'No matching quests' : 'No quests found'}
                  message={
                    search
                      ? 'Try another search term.'
                      : 'Add quests in Supabase and refresh.'
                  }
                  onRetry={() => {
                    if (search) setSearch('')
                    else void loadQuests()
                  }}
                />
              ) : (
                <div className="quest-grid">
                  {filteredQuests.map((quest) => (
                    <QuestCard
                      key={quest.id}
                      quest={quest}
                      joined={joined.includes(quest.id)}
                      joining={joiningId === quest.id}
                      onJoin={() => void handleJoin(quest)}
                      sponsoredReward={questRewardViews.find((reward) => reward.quest_id === quest.id)}
                    />
                  ))}
                </div>
              )}

              <p className="demo-note page-demo-note">
                <ShieldCheck size={14} />
                Quest records and participation are stored in Supabase.
                Points and volunteer counts are currently estimates.
              </p>
            </section>
          )}

          {page === 'Submit Proof' && (
            <section className="section-block page-section">
              <div className="eyebrow">SHOW YOUR IMPACT</div>
              <h2>Submit quest proof</h2>
              <p className="page-intro">
                Tell us what you did. Submissions are marked pending until reviewed.
              </p>

              {joined.length === 0 ? (
                <div className="panel">
                  <h3>Join a quest first</h3>
                  <p className="page-intro">
                    You can submit proof for quests you've already joined.
                  </p>
                  <button className="primary-button" onClick={() => setPage('Explore Quests')}>
                    Explore quests
                  </button>
                </div>
              ) : (
                <form className="panel contribution-form" onSubmit={handleSubmitContribution}>
                  <label className="contribution-field">
                    <span>Quest</span>
                    <select
                      value={selectedQuestId}
                      onChange={(event) => setSelectedQuestId(event.target.value)}
                      required
                    >
                      <option value="">Select a quest you joined</option>
                      {quests.filter((quest) => joined.includes(quest.id)).map((quest) => (
                        <option key={quest.id} value={quest.id}>{quest.title}</option>
                      ))}
                    </select>
                  </label>

                  <label className="contribution-field">
                    <span>What did you contribute?</span>
                    <textarea
                      value={contributionNotes}
                      onChange={(event) => setContributionNotes(event.target.value)}
                      placeholder="Describe what you did and how it helped..."
                      rows={5}
                      maxLength={2000}
                      required
                    />
                  </label>

                  <label className="contribution-field">
                    <span>Evidence URL (optional)</span>
                    <input
                      type="url"
                      value={evidenceUrl}
                      onChange={(event) => setEvidenceUrl(event.target.value)}
                      placeholder="https://example.com/evidence"
                    />
                    <small>Use a link to evidence you have permission to share. Photo uploads aren't enabled yet.</small>
                  </label>

                  {contributionError && (
                    <p className="auth-error" role="alert">{contributionError}</p>
                  )}

                  <button className="primary-button" type="submit" disabled={contributionSubmitting}>
                    {contributionSubmitting ? 'Submitting...' : 'Submit for review'}
                    {!contributionSubmitting && <ArrowRight size={16} />}
                  </button>
                </form>
              )}
            </section>
          )}

          {page === 'My Contributions' && (
            <section className="section-block page-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">YOUR SUBMISSIONS</div>
                  <h2>My contributions</h2>
                  <p>Review the status of proof you've submitted.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => session && void loadContributions(session.user.id)}
                  disabled={contributionsLoading}
                >
                  {contributionsLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>

              {contributionError && (
                <ErrorNotice
                  message={contributionError}
                  onRetry={() => session && void loadContributions(session.user.id)}
                />
              )}

              {contributionsLoading ? (
                <LoadingNotice message="Loading your contributions..." />
              ) : contributions.length === 0 ? (
                <div className="empty-state">
                  <ShieldCheck size={30} />
                  <h3>No submissions yet</h3>
                  <p>After joining a quest, submit proof to see it listed here.</p>
                  <button className="primary-button" onClick={() => setPage('Submit Proof')}>
                    Submit proof
                  </button>
                </div>
              ) : (
                <div className="contribution-list">
                  {contributions.map((contribution) => {
                    const quest = quests.find((item) => item.id === contribution.quest_id)
                    const status = (contribution.status || 'pending').toLowerCase()
                    return (
                      <article className="panel contribution-item" key={contribution.id}>
                        <div className="contribution-item-top">
                          <div>
                            <h3>{quest?.title || 'Community quest'}</h3>
                            <p>{new Date(contribution.created_at).toLocaleString()}</p>
                          </div>
                          <span className={`contribution-status status-${status}`}>
                            {status}
                          </span>
                        </div>
                        <p className="contribution-notes">{contribution.notes || 'No notes provided.'}</p>
                        {contribution.evidence_url && (
                          <a href={contribution.evidence_url} target="_blank" rel="noreferrer">
                            View evidence link <ArrowRight size={14} />
                          </a>
                        )}
                        {contribution.status.toLowerCase() === 'approved' && (
                          <div className="action-row" style={{ marginTop: 12 }}>
                            {rewardClaims.find((claim) => claim.contribution_id === contribution.id) ? (
                              <p><strong>Your reward code:</strong> {rewardClaims.find((claim) => claim.contribution_id === contribution.id)?.claim_code}</p>
                            ) : (
                              <button
                                className="primary-button"
                                disabled={claimingContributionId === contribution.id}
                                onClick={() => void claimRewardForContribution(contribution)}
                              >
                                {claimingContributionId === contribution.id ? 'Claiming...' : 'Claim my reward'}
                              </button>
                            )}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {page === 'Become an Area Admin' && (
            <section className="section-block page-section">
              <div className="eyebrow">HELP LEAD YOUR COMMUNITY</div>
              <h2>Become an Area Admin</h2>
              <p className="page-intro">Apply to help verify local contributions and support volunteers. The Super Admin reviews every application.</p>
              {applicationError && <ErrorNotice message={applicationError} onRetry={() => session && void loadMyAdminApplication(session.user.id)} />}
              {applicationStatus && ['pending', 'under_review', 'approved'].includes(applicationStatus.status) ? (
                <div className="panel contribution-form">
                  <h3>Your latest application</h3>
                  <p><strong>Status:</strong> <span className={`contribution-status status-${applicationStatus.status}`}>{applicationStatus.status.replace('_', ' ')}</span></p>
                  <p><strong>Requested area:</strong> {areas.find((a) => a.id === applicationStatus.area_id)?.name || 'Area'}</p>
                  <p>{applicationStatus.reason}</p>
                  {applicationStatus.review_notes && <p><strong>Review notes:</strong> {applicationStatus.review_notes}</p>}
                  {applicationStatus.status === 'rejected' && <p>You can apply again after the previous application has been closed.</p>}
                  <button className="text-button" onClick={() => session && void loadMyAdminApplication(session.user.id)}>Refresh application status</button>
                </div>
              ) : (
                <>
                {applicationStatus?.status === 'rejected' && <div className="panel"><p>Your previous application was rejected. You may submit a new application with updated details.</p>{applicationStatus.review_notes && <p><strong>Review notes:</strong> {applicationStatus.review_notes}</p>}</div>}
                <form className="panel contribution-form" onSubmit={handleApplyForAdmin}>
                  <label className="contribution-field"><span>Account email</span><input value={session.user.email || ''} readOnly /></label>
                  <label className="contribution-field"><span>Area you want to manage</span>
                    <select value={applicationAreaId} onChange={(event) => setApplicationAreaId(event.target.value)} required>
                      <option value="">Select an area</option>
                      {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                    </select>
                  </label>
                  <label className="contribution-field"><span>Why do you want to become an Area Admin?</span>
                    <textarea value={applicationReason} onChange={(event) => setApplicationReason(event.target.value)} minLength={20} maxLength={1000} rows={5} required placeholder="Tell us about your interest in helping your local community..." />
                  </label>
                  <button className="primary-button" type="submit" disabled={applicationSubmitting || areas.length === 0}>{applicationSubmitting ? 'Submitting...' : 'Submit application'} <ArrowRight size={16} /></button>
                  {areas.length === 0 && <small>No areas are configured yet. Contact the Super Admin.</small>}
                </form>
                </>
              )}
            </section>
          )}

          {page === 'Super Admin' && profile.role === 'super_admin' && (
            <section className="section-block page-section">
              <div className="eyebrow">PLATFORM MANAGEMENT</div>
              <h2>Super Admin</h2>
              <p className="page-intro">Review area coverage, see who manages each area, and approve no more than one Area Admin per area. Areas without an assigned admin are temporarily managed by you.</p>

              <div className="section-heading"><div><h3>Area administration</h3><p>Each area should have one assigned Area Admin.</p></div><button className="text-button" onClick={() => void loadAreaAdminAssignments()} disabled={areaAdminAssignmentsLoading}>{areaAdminAssignmentsLoading ? 'Refreshing...' : 'Refresh area admins'}</button></div>
              {areaAdminAssignmentsError && <ErrorNotice message={areaAdminAssignmentsError} onRetry={() => void loadAreaAdminAssignments()} />}
              {areaAdminAssignmentsLoading ? <LoadingNotice message="Loading area assignments..." /> : (
                <div className="quest-grid area-admin-grid">
                  {areas.map((area) => {
                    const assigned = areaAdminAssignments.filter((assignment) => assignment.area_id === area.id)
                    const currentAdmin = assigned[0]
                    return (
                      <article className="panel area-admin-card" key={area.id}>
                        <div className="area-admin-card-top"><span className="community-icon"><MapPin size={18} /></span><span className={`contribution-status ${currentAdmin ? 'status-approved' : 'status-pending'}`}>{currentAdmin ? 'Admin assigned' : 'No area admin'}</span></div>
                        <h3>{area.name}</h3>
                        {currentAdmin ? (
                          <div className="area-admin-details">
                            <p><strong>Account:</strong> {currentAdmin.email || 'Email unavailable'}</p>
                            <p><strong>User ID:</strong> <span className="area-admin-user-id">{currentAdmin.user_id}</span></p>
                            <button
                              className="text-button"
                              style={{ color: '#b42318', border: '1px solid #f2c8c5', marginTop: 8 }}
                              disabled={dismissingAreaAdminId === currentAdmin.user_id}
                              onClick={() => void dismissAreaAdmin(currentAdmin)}
                            >
                              {dismissingAreaAdminId === currentAdmin.user_id ? 'Dismissing...' : 'Dismiss Area Admin'}
                            </button>
                            {assigned.length > 1 && <p className="auth-error">Warning: multiple admins are assigned. Review your database assignments.</p>}
                          </div>
                        ) : (
                          <div className="area-admin-details"><p>This area is currently handled by the Super Admin.</p><p>Approve an applicant for this area to assign a local admin.</p></div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}

              <div className="section-heading" style={{ marginTop: 28 }}>
                <div><h3>Area Admin history</h3><p>Recent assignments, dismissals, and area changes (latest 100 events).</p></div>
                <button className="text-button" onClick={() => void loadAreaAdminHistory()} disabled={areaAdminHistoryLoading}>{areaAdminHistoryLoading ? 'Refreshing...' : 'Refresh history'}</button>
              </div>
              {areaAdminHistoryError && <ErrorNotice message={areaAdminHistoryError} onRetry={() => void loadAreaAdminHistory()} />}
              {areaAdminHistoryLoading ? <LoadingNotice message="Loading Area Admin history..." /> : areaAdminHistory.length === 0 ? (
                <div className="empty-state"><ShieldCheck size={26} /><h3>No history yet</h3><p>New Area Admin assignments and dismissals will be recorded from now on.</p></div>
              ) : (
                <div className="contribution-list">
                  {areaAdminHistory.map((entry) => {
                    const areaName = areas.find((area) => area.id === entry.area_id)?.name || 'Area removed or unavailable'
                    const application = applications.find((item) => item.user_id === entry.user_id)
                    const label = entry.action === 'assigned' ? 'Admin assigned' : entry.action === 'dismissed' ? 'Admin dismissed' : 'Admin reassigned'
                    return (
                      <article className="panel contribution-item" key={entry.id}>
                        <div className="contribution-item-top">
                          <div><h3>{label}</h3><p>{new Date(entry.created_at).toLocaleString()}</p></div>
                          <span className={`contribution-status ${entry.action === 'dismissed' ? 'status-rejected' : 'status-approved'}`}>{entry.action}</span>
                        </div>
                        <p><strong>Area:</strong> {areaName}</p>
                        <p><strong>Admin:</strong> {entry.admin_email || application?.applicant_email || 'Email unavailable'}</p>
                        <p><strong>Admin user ID:</strong> <span className="area-admin-user-id">{entry.user_id}</span></p>
                        <p><strong>Recorded by user ID:</strong> {entry.performed_by || 'System'}</p>
                      </article>
                    )
                  })}
                </div>
              )}

              <div className="section-heading" style={{ marginTop: 28 }}><div><h3>Applications awaiting review</h3><p>Approval grants the applicant area-admin access.</p></div><button className="text-button" onClick={() => void loadAdminApplications()} disabled={applicationsLoading}>{applicationsLoading ? 'Refreshing...' : 'Refresh applications'}</button></div>
              {applicationError && <ErrorNotice message={applicationError} onRetry={() => void loadAdminApplications()} />}
              {applicationsLoading ? <LoadingNotice message="Loading applications..." /> : applications.length === 0 ? <div className="empty-state"><ShieldCheck size={30} /><h3>No applications to review</h3><p>New applications will appear here.</p></div> : (
                <div className="contribution-list">
                  {applications.map((application) => (
                    <article className="panel contribution-item" key={application.id}>
                      <div className="contribution-item-top"><div><h3>{application.applicant_email || application.user_id}</h3><p>Applied {new Date(application.created_at).toLocaleString()}</p></div><span className={`contribution-status status-${application.status}`}>{application.status.replace('_', ' ')}</span></div>
                      <p><strong>Requested area:</strong> {areas.find((area) => area.id === application.area_id)?.name || 'Unknown area'}</p>
                      <p className="contribution-notes">{application.reason}</p>
                      <label className="contribution-field"><span>Review notes (optional)</span><textarea rows={2} value={reviewNotesById[application.id] || ''} onChange={(event) => setReviewNotesById((current) => ({ ...current, [application.id]: event.target.value }))} placeholder="Feedback for the applicant..." /></label>
                      <div className="admin-review-actions">
                        <button className="primary-button" disabled={reviewingApplicationId === application.id || areaAdminAssignmentsLoading || areaAdminAssignments.some((assignment) => assignment.area_id === application.area_id && assignment.user_id !== application.user_id)} onClick={() => void reviewApplication(application, 'approved')}>{reviewingApplicationId === application.id ? 'Saving...' : areaAdminAssignments.some((assignment) => assignment.area_id === application.area_id && assignment.user_id !== application.user_id) ? 'Area already assigned' : 'Approve & assign'}</button>
                        <button className="text-button" disabled={reviewingApplicationId === application.id} onClick={() => void reviewApplication(application, 'under_review')}>Mark under review</button>
                        <button className="text-button" disabled={reviewingApplicationId === application.id} onClick={() => void reviewApplication(application, 'rejected')}>Reject</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {page === 'Company Dashboard' && myCompanyApplication?.status === 'approved' && (
            <section className="section-block page-section">
              <div className="eyebrow">COMPANY PARTNER WORKSPACE</div>
              <h2>Welcome, {myCompanyApplication.company_name}</h2>
              <p className="page-intro">
                Your company is approved to participate in CivicQuest. This dashboard is the starting point for sponsor rewards.
              </p>
              <div className="stats-grid">
                <StatCard icon={<Building2 size={21} />} iconClass="stat-purple" trend="Partner status" value="Approved" label="Company account" foot="Application verified by Super Admin" />
                <StatCard
                  icon={<Gift size={21} />}
                  iconClass="stat-green"
                  trend="Your offers"
                  value={String(sponsorRewards.filter((reward) => reward.company_application_id === myCompanyApplication.id).length)}
                  label="Reward offers submitted"
                  foot={`${sponsorRewards.filter((reward) => reward.company_application_id === myCompanyApplication.id && reward.status === 'pending').length} pending approval · ${sponsorRewards.filter((reward) => reward.company_application_id === myCompanyApplication.id && reward.status === 'approved').length} approved`}
                />
              </div>
              <div className="panel contribution-form">
                <h3>Company profile</h3>
                <p><strong>Company:</strong> {myCompanyApplication.company_name}</p>
                <p><strong>Email:</strong> {myCompanyApplication.email}</p>
                <p><strong>Area:</strong> {areas.find((area) => area.id === myCompanyApplication.area_id)?.name || 'Not assigned'}</p>
                <p><strong>Approval status:</strong> <span className="contribution-status status-approved">approved</span></p>
              </div>
              <div className="panel contribution-form">
                <h3>Create a reward offer</h3>
                <p className="page-intro">Offers are reviewed by the Super Admin before they can be attached to quests.</p>
                <form onSubmit={(event) => void submitSponsorReward(event)} className="form-stack">
                  <label className="contribution-field"><span>Reward title</span><input required maxLength={100} value={rewardTitle} onChange={(event) => setRewardTitle(event.target.value)} placeholder="e.g. Free basic health check-up" /></label>
                  <label className="contribution-field"><span>Description and eligibility</span><textarea required maxLength={1000} value={rewardDescription} onChange={(event) => setRewardDescription(event.target.value)} placeholder="Explain who qualifies and how to redeem it." rows={3} /></label>
                  <label className="contribution-field"><span>Reward type</span><select value={rewardType} onChange={(event) => setRewardType(event.target.value as SponsorReward['reward_type'])}><option value="coupon">Coupon</option><option value="discount">Discount</option><option value="voucher">Voucher</option><option value="free_item">Free item</option><option value="service">Service</option></select></label>
                  <label className="contribution-field"><span>Value / offer</span><input required maxLength={100} value={rewardValue} onChange={(event) => setRewardValue(event.target.value)} placeholder="e.g. 20% off or 1 free check-up" /></label>
                  <label className="contribution-field"><span>Choose the one quest this reward is for</span><select required value={rewardQuestId} onChange={(event) => setRewardQuestId(event.target.value)}><option value="">Select a quest</option>{quests.filter((quest) => !myCompanyApplication.area_id || quest.area_id === myCompanyApplication.area_id).map((quest) => <option key={quest.id} value={quest.id}>{quest.title}</option>)}</select></label>
                  <p className="form-hint">This reward will be linked to this quest only. Citizens will see it after Super Admin approval.</p>
                  <label className="contribution-field"><span>Available quantity</span><input required type="number" min="1" max="100000" value={rewardQuantity} onChange={(event) => setRewardQuantity(event.target.value)} /></label>
                  {rewardError && <ErrorNotice message={rewardError} onRetry={() => void loadSponsorRewards()} />}
                  <button className="primary-button" type="submit" disabled={rewardSubmitting}>{rewardSubmitting ? 'Submitting...' : 'Submit reward for approval'}</button>
                </form>
              </div>
              <div className="panel contribution-form">
                <div className="section-heading"><h3>Your reward offers</h3><button className="text-button" onClick={() => void loadSponsorRewards()}>Refresh</button></div>
                {rewardLoading ? <LoadingNotice message="Loading reward offers..." /> : sponsorRewards.filter((reward) => reward.company_application_id === myCompanyApplication.id).length === 0 ? <p>No offers yet. Create your first reward above.</p> : <div className="contribution-list">{sponsorRewards.filter((reward) => reward.company_application_id === myCompanyApplication.id).map((reward) => <article className="panel contribution-item" key={reward.id}><div className="contribution-item-top"><div><h3>{reward.title}</h3><p>{reward.reward_value} · {reward.quantity} available</p><p>{reward.description}</p><p><strong>Quest:</strong> {quests.find((quest) => quest.id === reward.quest_id)?.title || 'Quest selected'}</p> {reward.payment_account_number && <p><strong>Publishing fee transfer account:</strong> {reward.payment_account_number}</p>}</div><span className={`contribution-status status-${reward.status}`}>{reward.status}</span></div></article>)}</div>}
              </div>
            </section>
          )}

          {page === 'Company Applications' && profile.role === 'super_admin' && (
            <section className="section-block page-section">
              <div className="eyebrow">SPONSOR MANAGEMENT</div>
              <h2>Company applications</h2>
              <p className="page-intro">
                Review sponsor registrations before allowing them to publish rewards.
                Approval here records the decision; reward publishing and company dashboard access are separate steps.
              </p>

              <div className="section-heading">
                <div>
                  <h3>Registered companies</h3>
                  <p>Pending applications need a decision from a Super Admin.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => void loadCompanyApplications()}
                  disabled={companyApplicationsLoading}
                >
                  {companyApplicationsLoading ? 'Refreshing...' : 'Refresh applications'}
                </button>
              </div>

              {companyApplicationError && (
                <ErrorNotice
                  message={companyApplicationError}
                  onRetry={() => void loadCompanyApplications()}
                />
              )}

              {companyApplicationsLoading ? (
                <LoadingNotice message="Loading company applications..." />
              ) : companyApplications.length === 0 ? (
                <div className="empty-state">
                  <Building2 size={30} />
                  <h3>No company applications found</h3>
                  <p>New company registrations will appear here.</p>
                </div>
              ) : (
                <div className="contribution-list">
                  {companyApplications.map((application) => (
                    <article className="panel contribution-item" key={application.id}>
                      <div className="contribution-item-top">
                        <div>
                          <h3>{application.company_name}</h3>
                          <p>{application.email}</p>
                          <p>Applied {new Date(application.created_at).toLocaleString()}</p>
                        </div>
                        <span className={`contribution-status status-${application.status}`}>
                          {application.status}
                        </span>
                      </div>
                      <p>
                        <strong>Area:</strong>{' '}
                        {areas.find((area) => area.id === application.area_id)?.name || 'Unknown area'}
                      </p>
                      {application.status === 'pending' && (
                        <div className="admin-review-actions">
                          <button
                            className="primary-button"
                            disabled={reviewingCompanyId === application.id}
                            onClick={() => void reviewCompanyApplication(application, 'approved')}
                          >
                            {reviewingCompanyId === application.id ? 'Saving...' : 'Approve company'}
                          </button>
                          <button
                            className="text-button"
                            disabled={reviewingCompanyId === application.id}
                            onClick={() => void reviewCompanyApplication(application, 'rejected')}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {page === 'Reward Approvals' && profile.role === 'super_admin' && (
            <section className="section-block page-section">
              <div className="eyebrow">SPONSOR REWARD GOVERNANCE</div>
              <h2>Reward approvals</h2>
              <p className="page-intro">Review company offers, then approved offers can be attached to quests by an Area Admin.</p>
              <div className="section-heading"><h3>Submitted offers</h3><button className="text-button" disabled={rewardLoading} onClick={() => void loadSponsorRewards()}>{rewardLoading ? 'Refreshing...' : 'Refresh rewards'}</button></div>
              {rewardError && <ErrorNotice message={rewardError} onRetry={() => void loadSponsorRewards()} />}
              {rewardLoading ? <LoadingNotice message="Loading rewards..." /> : sponsorRewards.length === 0 ? <EmptyNotice title="No reward offers yet" message="Company submissions will appear here." onRetry={() => void loadSponsorRewards()} /> : <div className="contribution-list">{sponsorRewards.map((reward) => {
                const company = companyApplications.find((item) => item.id === reward.company_application_id)
                return <article className="panel contribution-item" key={reward.id}><div className="contribution-item-top"><div><h3>{reward.title}</h3><p>{company?.company_name || 'Company partner'} · {reward.reward_type} · {reward.reward_value}</p><p>{reward.description}</p><p>Quantity: {reward.quantity}</p><p><strong>Quest:</strong> {quests.find((quest) => quest.id === reward.quest_id)?.title || 'No quest selected'}</p></div><span className={`contribution-status status-${reward.status}`}>{reward.status}</span></div>{reward.status === 'pending' && <div className="contribution-form"><label className="contribution-field"><span>Account number to show this company (required to approve)</span><input value={rewardAccountNumbers[reward.id] || ''} onChange={(event) => setRewardAccountNumbers((current) => ({ ...current, [reward.id]: event.target.value }))} placeholder="Enter admin-designated account number" /></label><p className="form-hint">Payment is optional for this hackathon demo. The account number is shown to this company after approval.</p><div className="action-row"><button className="primary-button" disabled={reviewingRewardId === reward.id} onClick={() => void reviewSponsorReward(reward, 'approved')}>Approve</button><button className="secondary-button" disabled={reviewingRewardId === reward.id} onClick={() => void reviewSponsorReward(reward, 'rejected')}>Reject</button></div></div>}</article>
              })}</div>}
            </section>
          )}

          {page === 'Area Admin' && (profile.role === 'area_admin' || profile.role === 'super_admin') && (
            <section className="section-block page-section">
              <div className="eyebrow">LOCAL VERIFICATION</div>
              <h2>Area Admin dashboard</h2>
              <p className="page-intro">Review pending proof for {profile.role === 'super_admin' ? 'all areas you are authorized to manage' : assignedAreaName}. Access is enforced by Supabase policies.</p>
              <div className="panel contribution-form">
                <h3>Attach an approved sponsor reward to a quest</h3>
                <p className="page-intro">Only approved offers in the quest's area can be assigned.</p>
                <form onSubmit={(event) => void assignRewardToQuest(event)} className="form-stack">
                  <label className="contribution-field"><span>Quest</span><select required value={assignQuestId} onChange={(event) => setAssignQuestId(event.target.value)}><option value="">Choose a quest</option>{quests.filter((quest) => profile.role === 'super_admin' || quest.area_id === profile.area_id).map((quest) => <option key={quest.id} value={quest.id}>{quest.title}</option>)}</select></label>
                  <label className="contribution-field"><span>Approved reward</span><select required value={assignRewardId} onChange={(event) => setAssignRewardId(event.target.value)}><option value="">Choose a reward</option>{sponsorRewards.filter((reward) => reward.status === 'approved' && (profile.role === 'super_admin' || reward.area_id === profile.area_id)).map((reward) => <option key={reward.id} value={reward.id}>{reward.title} — {reward.reward_value}</option>)}</select></label>
                  {rewardError && <ErrorNotice message={rewardError} onRetry={() => void loadSponsorRewards()} />}
                  <button className="primary-button" type="submit">Attach reward to quest</button>
                </form>
              </div>
              <div className="panel contribution-form" style={{ marginBottom: 24 }}>
                <h3>Create a quest for {profile.role === 'super_admin' ? 'an area' : assignedAreaName}</h3>
                {profile.role === 'super_admin' && (
                  <label className="contribution-field">
                    <span>Area</span>
                    <select value={selectedAreaId} onChange={(event) => setSelectedAreaId(event.target.value)} required>
                      <option value="">Select area</option>
                      {areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                    </select>
                  </label>
                )}
                {questCreateError && <p className="auth-error" role="alert">{questCreateError}</p>}
                <form onSubmit={handleCreateQuest}>
                  <label className="contribution-field"><span>Quest title</span><input value={questTitle} onChange={(event) => setQuestTitle(event.target.value)} maxLength={120} required /></label>
                  <label className="contribution-field"><span>Description</span><textarea value={questDescription} onChange={(event) => setQuestDescription(event.target.value)} rows={3} maxLength={2000} required /></label>
                  <label className="contribution-field"><span>Category</span><select value={questCategory} onChange={(event) => setQuestCategory(event.target.value)}><option>Environment</option><option>Education</option><option>Community</option><option>Health</option><option>Accessibility</option></select></label>
                  <label className="contribution-field"><span>Location</span><input value={questLocation} onChange={(event) => setQuestLocation(event.target.value)} maxLength={160} required /></label>
                  <label className="contribution-field"><span>XP reward</span><input type="number" min="1" max="10000" value={questXp} onChange={(event) => setQuestXp(event.target.value)} required /></label>
                  <button className="primary-button" type="submit" disabled={questCreating || areas.length === 0}>{questCreating ? 'Creating quest...' : 'Create quest'} <Plus size={16} /></button>
                </form>
              </div>
              <div className="section-heading"><div><h3>Pending contributions</h3><p>Approve only work you have verified.</p></div><button className="text-button" onClick={() => void loadAreaContributions()} disabled={adminContributionsLoading}>{adminContributionsLoading ? 'Refreshing...' : 'Refresh'}</button></div>
              {contributionError && <ErrorNotice message={contributionError} onRetry={() => void loadAreaContributions()} />}
              {adminContributionsLoading ? <LoadingNotice message="Loading pending contributions..." /> : adminContributions.length === 0 ? <div className="empty-state"><CheckCircle2 size={30} /><h3>No pending contributions</h3><p>New submissions for your authorized area will appear here.</p></div> : (
                <div className="contribution-list">
                  {adminContributions.map((contribution) => {
                    const quest = quests.find((item) => item.id === contribution.quest_id)
                    return <article className="panel contribution-item" key={contribution.id}>
                      <div className="contribution-item-top"><div><h3>{quest?.title || 'Community quest'}</h3><p>Submitted {new Date(contribution.created_at).toLocaleString()}</p></div><span className="contribution-status status-pending">pending</span></div>
                      <p className="contribution-notes">{contribution.notes || 'No notes provided.'}</p>
                      {contribution.evidence_url && <p><a href={contribution.evidence_url} target="_blank" rel="noreferrer">Open evidence link <ArrowRight size={14} /></a></p>}
                      <div className="admin-review-actions"><button className="primary-button" disabled={reviewingContributionId === contribution.id} onClick={() => void reviewContribution(contribution, 'approved')}>Approve proof</button><button className="text-button" disabled={reviewingContributionId === contribution.id} onClick={() => void reviewContribution(contribution, 'rejected')}>Reject proof</button></div>
                    </article>
                  })}
                </div>
              )}
            </section>
          )}

          {page === 'Neighborhoods' && (
            <section className="section-block page-section">
              <div className="eyebrow">STRONGER TOGETHER</div>
              <h2>Discover your neighborhoods</h2>
              <p className="page-intro">
                Communities grow when neighbors work toward shared goals.
              </p>

              <div className="feature-grid">
                <FeaturePanel
                  icon={<MapPin size={24} />}
                  iconClass="stat-green"
                  title="Find local initiatives"
                  description="Discover community cleanups, education events, and neighborhood improvement projects."
                  action="Explore activities"
                  onClick={() => setPage('Explore Quests')}
                />
                <FeaturePanel
                  icon={<Users size={24} />}
                  iconClass="stat-purple"
                  title="Meet local volunteers"
                  description="Connect with people who care about the same causes and want to make a difference."
                  action="Find volunteers"
                  onClick={() => notify('Volunteer groups are coming soon.')}
                />
                <FeaturePanel
                  icon={<Globe2 size={24} />}
                  iconClass="stat-orange"
                  title="Share community impact"
                  description="Work together on local priorities and celebrate positive changes."
                  action="Learn more"
                  onClick={() => notify('Community impact reports are coming soon.')}
                />
              </div>
            </section>
          )}

          {page === 'Rewards' && (
            <section className="section-block page-section">
              <div className="eyebrow">CELEBRATE YOUR CONTRIBUTION</div>
              <h2>Rewards and recognition</h2>
              <p className="page-intro">
                Your effort matters. Build a record of meaningful community
                participation.
              </p>

              <div className="panel contribution-form">
                <h3>Sponsor rewards linked to quests</h3>
                <p className="page-intro">See the extra rewards offered by community partners. Eligibility depends on completing the linked quest and having your contribution verified.</p>
                {questRewardViews.length === 0 ? <p>No sponsor rewards are linked to quests yet.</p> : <div className="feature-grid">{questRewardViews.map((item) => <article className="panel feature-panel" key={item.id}><div className="reward-big-icon"><Gift size={24} /></div><h3>{item.title}</h3><p><strong>{item.reward_value}</strong> · {item.company_name}</p><p>{item.description}</p><p className="eyebrow">Quest: {quests.find((quest) => quest.id === item.quest_id)?.title || 'Community quest'}</p></article>)}</div>}
              </div>

              <div className="rewards-hero panel">
                <div className="reward-big-icon">
                  <Award size={36} />
                </div>
                <div>
                  <span className="reward-label">ESTIMATED IMPACT POINTS</span>
                  <div className="reward-total">
                    {joined.reduce((sum, id) => {
                      const quest = quests.find((item) => item.id === id)
                      return sum + (quest?.points || 0)
                    }, 0)}
                  </div>
                  <p>
                    Estimated points only. Verified contribution rewards will
                    be added later.
                  </p>
                </div>
              </div>

              <div className="feature-grid">
                <FeaturePanel
                  icon={<Leaf size={24} />}
                  iconClass="stat-green"
                  title="Green Guardian"
                  description="Participate in environmental initiatives."
                  action="Recognition concept"
                  onClick={() => notify('Verified badges are coming soon.')}
                />
                <FeaturePanel
                  icon={<BookOpen size={24} />}
                  iconClass="stat-purple"
                  title="Learning Champion"
                  description="Support education and knowledge sharing."
                  action="Recognition concept"
                  onClick={() => notify('Verified badges are coming soon.')}
                />
                <FeaturePanel
                  icon={<HandHeart size={24} />}
                  iconClass="stat-orange"
                  title="Community Helper"
                  description="Show up for people in your community."
                  action="Recognition concept"
                  onClick={() => notify('Verified badges are coming soon.')}
                />
              </div>
            </section>
          )}

          {page === 'Knowledge Hub' && (
            <section className="section-block page-section">
              <div className="eyebrow">LEARN, GROW, CONTRIBUTE</div>
              <h2>Knowledge hub</h2>
              <p className="page-intro">
                Explore simple ways to become a more effective community
                volunteer.
              </p>

              <div className="feature-grid">
                <FeaturePanel
                  icon={<Leaf size={24} />}
                  iconClass="stat-green"
                  title="Environmental action"
                  description="Learn about waste reduction, tree care, and sustainable communities."
                  action="Explore topic"
                  onClick={() => notify('Learning resources are coming soon.')}
                />
                <FeaturePanel
                  icon={<BookOpen size={24} />}
                  iconClass="stat-purple"
                  title="Digital inclusion"
                  description="Help people build digital confidence and use technology safely."
                  action="Explore topic"
                  onClick={() => notify('Learning resources are coming soon.')}
                />
                <FeaturePanel
                  icon={<HandHeart size={24} />}
                  iconClass="stat-orange"
                  title="Responsible volunteering"
                  description="Make your efforts inclusive, respectful, and useful to the community."
                  action="Explore topic"
                  onClick={() => notify('Learning resources are coming soon.')}
                />
              </div>
            </section>
          )}

          <footer className="page-footer">
            <span>© 2026 CivicQuest</span>
            <span>Built for communities, powered by people.</span>
          </footer>
        </div>
      </main>

      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice('')}
          >
            <X size={17} />
          </button>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon,
  iconClass,
  trend,
  value,
  label,
  foot,
}: {
  icon: React.ReactNode
  iconClass: string
  trend: string
  value: string | number
  label: string
  foot: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <div className={`stat-icon ${iconClass}`}>{icon}</div>
        <span className="stat-trend">{trend}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-foot">{foot}</div>
    </div>
  )
}

function QuestCard({
  quest,
  joined,
  joining,
  onJoin,
  sponsoredReward,
}: {
  quest: Quest
  joined: boolean
  joining: boolean
  onJoin: () => void
  sponsoredReward?: QuestRewardView
}) {
  return (
    <article className="quest-card">
      <div className="quest-image-wrap">
        <img
          className="quest-image"
          src={quest.image}
          alt=""
          loading="lazy"
        />
        <span className={`quest-category category-${quest.color}`}>
          {quest.category}
        </span>
      </div>

      <div className="quest-card-content">
        {sponsoredReward && (
          <span className="contribution-status status-approved" style={{ display: 'inline-block', marginBottom: 8 }}>
            Sponsored Quest
          </span>
        )}
        <h4>{sponsoredReward ? `${sponsoredReward.company_name} Presents: ${quest.title}` : quest.title}</h4>
        <p className="quest-description">{quest.description}</p>
        {sponsoredReward && (
          <div className="panel" style={{ padding: 12, marginTop: 10, marginBottom: 12 }}>
            <p><strong><Gift size={15} style={{ display: 'inline', verticalAlign: 'middle' }} /> Reward: {sponsoredReward.title}</strong></p>
            <p>{sponsoredReward.reward_type} · {sponsoredReward.reward_value}</p>
            <p><strong>Coupons remaining:</strong> {Math.max(0, (sponsoredReward.quantity || 0) - (sponsoredReward.claimed_count || 0))}</p>
            {sponsoredReward.inventory_status === 'sold_out' && (
              <p><strong>All coupons claimed — this quest has ended.</strong></p>
            )}
            <p>{sponsoredReward.description}</p>
            <p className="form-hint">Reward is provided after quest completion is verified, subject to availability and offer terms.</p>
          </div>
        )}

        <div className="quest-meta">
          <span>
            <MapPin size={15} />
            {quest.location}
          </span>
          <span>
            <Users size={15} />
            {quest.volunteers} volunteers
          </span>
        </div>

        <div className="quest-card-footer">
          <div className="quest-points">
            <Zap size={16} />
            <strong>{quest.points} pts</strong>
          </div>

          <button
            className={`join-button ${joined ? 'joined-button' : ''}`}
            onClick={onJoin}
            disabled={joined || joining || sponsoredReward?.inventory_status === 'sold_out'}
          >
            {sponsoredReward?.inventory_status === 'sold_out' ? (
              'Quest ended'
            ) : joining ? (
              'Joining...'
            ) : joined ? (
              <>
                <CheckCircle2 size={15} /> Joined
              </>
            ) : (
              <>
                Join quest <ArrowRight size={15} />
              </>
            )}
          </button>
        </div>
      </div>
    </article>
  )
}

function FeaturePanel({
  icon,
  iconClass,
  title,
  description,
  action,
  onClick,
}: {
  icon: React.ReactNode
  iconClass: string
  title: string
  description: string
  action: string
  onClick: () => void
}) {
  return (
    <div className="panel feature-panel">
      <div className={`feature-icon ${iconClass}`}>{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <button className="text-button" onClick={onClick}>
        {action} <ArrowRight size={16} />
      </button>
    </div>
  )
}

function LoadingNotice({ message }: { message: string }) {
  return (
    <div className="panel empty-state">
      <Activity size={26} />
      <p>{message}</p>
    </div>
  )
}

function EmptyNotice({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry: () => void
}) {
  return (
    <div className="empty-state">
      <Compass size={30} />
      <h3>{title}</h3>
      <p>{message}</p>
      <button className="primary-button" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}

function ErrorNotice({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="panel" style={{ marginBottom: 18 }}>
      <p style={{ color: '#a32d2d', fontSize: 12, overflowWrap: 'anywhere' }}>
        Could not load quests: {message}
      </p>
      <button className="primary-button" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}

export default App