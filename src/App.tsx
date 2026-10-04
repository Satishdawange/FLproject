import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  CalendarDays,
  CalendarRange,
  Clock,
  Download,
  FileText,
  IndianRupee,
  Layers,
  LayoutDashboard,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  TableProperties,
  Upload,
  ShieldCheck,
  Eye,
  SlidersHorizontal,
  X,
  FileSpreadsheet,
  Menu,
  BarChart3,
  Receipt,
} from 'lucide-react'

import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import './App.css'
import type { AuthUser, SessionEntry, SheetConfig, SheetItem, BillItem } from './types'

import {
  formatMinutes,
  formatRupees,
  groupSessionsByDay,
  groupSessionsByWeek,
  groupSessionsByMonth,
} from './utils/calculations'
import {
  getAvailableSheets,
  getDefaultSheetUrl,
  loadSheetEntriesCache,
  saveSheetEntriesCache,
  loadSheetBillsCache,
  saveSheetBillsCache,
  addCustomSheetUrl,
  removeCustomSheetUrl,
  cacheSheetName,
} from './utils/sheetManager'
import { googleSheetsApi } from './services/googleSheetsApi'
import { LoginModal } from './components/LoginModal'
import { GoogleSheetsModal } from './components/GoogleSheetsModal'
import { AddEntryModal } from './components/AddEntryModal'
import { ChallanModal } from './components/ChallanModal'
import { DailyBreakdownView } from './components/DailyBreakdownView'
import { WeeklyBreakdownView } from './components/WeeklyBreakdownView'
import { MonthlyBreakdownView } from './components/MonthlyBreakdownView'
import { AnalyticsView } from './components/AnalyticsView'
import { BillsView } from './components/BillsView'



export default function App() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  // Persistent Authentication (persists across sessions until logout, cache clear, or password change)
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem('fl_auth_user') || sessionStorage.getItem('fl_auth_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const isAdmin = currentUser?.role === 'admin'

  // Multi-Sheet State
  const [availableSheets, setAvailableSheets] = useState<SheetItem[]>(() => getAvailableSheets())

  const [activeSheetUrl, setActiveSheetUrl] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('fl_active_sheet_url')
      const sheets = getAvailableSheets()
      if (saved && sheets.some((s) => s.url === saved)) {
        return saved
      }
    } catch {
      // ignore
    }
    return getDefaultSheetUrl()
  })

  // Google Sheets Config
  const [sheetConfig, setSheetConfig] = useState<SheetConfig>(() => {
    const initialUrl = getDefaultSheetUrl()
    try {
      const savedUrl = localStorage.getItem('fl_active_sheet_url')
      const sheets = getAvailableSheets()
      const targetUrl = savedUrl && sheets.some((s) => s.url === savedUrl) ? savedUrl : initialUrl
      const activeSheetObj = sheets.find((s) => s.url === targetUrl)
      return {
        webAppUrl: targetUrl,
        sheetName: activeSheetObj?.name || 'Google Sheet',
        isConnected: Boolean(targetUrl),
      }
    } catch {
      return { webAppUrl: initialUrl, isConnected: Boolean(initialUrl) }
    }
  })

  // Session entries loaded from active sheet cache
  const [entries, setEntries] = useState<SessionEntry[]>(() => {
    const initialUrl = getDefaultSheetUrl()
    try {
      const savedUrl = localStorage.getItem('fl_active_sheet_url') || initialUrl
      return loadSheetEntriesCache(savedUrl)
    } catch {
      return []
    }
  })

  // Bills loaded from active sheet cache
  const [bills, setBills] = useState<BillItem[]>(() => {
    const initialUrl = getDefaultSheetUrl()
    try {
      const savedUrl = localStorage.getItem('fl_active_sheet_url') || initialUrl
      return loadSheetBillsCache(savedUrl)
    } catch {
      return []
    }
  })

  // View & UI Navigation
  const [activeView, setActiveView] = useState<
    'ledger' | 'daily' | 'weekly' | 'monthly' | 'analytics' | 'bills'
  >('ledger')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [period, setPeriod] = useState<'All time' | 'Today' | 'This week' | 'This month' | 'Custom'>('This month')
  // Client filter states
  const [selectedClient, setSelectedClient] = useState('All clients')
  const [isClientSearchMode, setIsClientSearchMode] = useState(false)
  const [clientSearchText, setClientSearchText] = useState('')

  // Project filter states
  const [selectedProject, setSelectedProject] = useState('All projects')
  const [isProjectSearchMode, setIsProjectSearchMode] = useState(false)
  const [projectSearchText, setProjectSearchText] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [customStartDate, setCustomStartDate] = useState(today)
  const [customEndDate, setCustomEndDate] = useState(today)

  const handleClientSelectChange = (val: string) => {
    if (val === '__search__') {
      setIsClientSearchMode(true)
      setClientSearchText('')
    } else {
      setIsClientSearchMode(false)
      setSelectedClient(val)
      setClientSearchText('')
    }
  }

  const handleResetClientSearch = () => {
    setIsClientSearchMode(false)
    setSelectedClient('All clients')
    setClientSearchText('')
  }

  const handleProjectSelectChange = (val: string) => {
    if (val === '__search__') {
      setIsProjectSearchMode(true)
      setProjectSearchText('')
    } else {
      setIsProjectSearchMode(false)
      setSelectedProject(val)
      setProjectSearchText('')
    }
  }

  const handleResetProjectSearch = () => {
    setIsProjectSearchMode(false)
    setSelectedProject('All projects')
    setProjectSearchText('')
  }

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSheetModal, setShowSheetModal] = useState(false)
  const [showChallanModal, setShowChallanModal] = useState(false)


  // Async Status
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)
  const [savingEntry, setSavingEntry] = useState(false)

  // Save entries to localStorage cache for a specific sheet URL
  const saveEntriesCache = (newEntries: SessionEntry[], urlToUse = activeSheetUrl) => {
    setEntries(newEntries)
    saveSheetEntriesCache(urlToUse, newEntries)
  }

  // Save bills to localStorage cache for a specific sheet URL
  const saveBillsCache = (newBills: BillItem[], urlToUse = activeSheetUrl) => {
    setBills(newBills)
    saveSheetBillsCache(urlToUse, newBills)
  }

  // Handle Sheet Config Save
  const handleSaveSheetConfig = (newConfig: SheetConfig) => {
    setSheetConfig(newConfig)
    localStorage.setItem('fl_sheet_config', JSON.stringify(newConfig))
    if (newConfig.webAppUrl && newConfig.webAppUrl !== activeSheetUrl) {
      setActiveSheetUrl(newConfig.webAppUrl)
      localStorage.setItem('fl_active_sheet_url', newConfig.webAppUrl)
    }
  }

  // Sync / Fetch data from Google Sheets (defaults to activeSheetUrl)
  const handleSyncWithGoogleSheets = useCallback(
    async (targetUrl = activeSheetUrl) => {
      if (!targetUrl) return
      setSyncing(true)
      setSyncStatus('Fetching records & bills from Google Sheet...')

      try {
        // Fetch connection ping, entries, and bills concurrently
        const [pingRes, res, billsRes] = await Promise.all([
          googleSheetsApi.testConnection(targetUrl).catch(() => null),
          googleSheetsApi.fetchEntries(targetUrl),
          googleSheetsApi.getBills(targetUrl).catch(() => ({ success: false, bills: [] })),
        ])

        const liveTitle = pingRes?.sheetName || res.sheetName
        if (liveTitle) {
          cacheSheetName(targetUrl, liveTitle)
          setAvailableSheets(getAvailableSheets())
        }

        if (res.success && Array.isArray(res.entries)) {
          saveEntriesCache(res.entries, targetUrl)

          if (billsRes && billsRes.success && Array.isArray(billsRes.bills)) {
            saveBillsCache(billsRes.bills, targetUrl)
          }

          const updatedConfig: SheetConfig = {
            webAppUrl: targetUrl,
            sheetName: liveTitle || sheetConfig.sheetName,
            isConnected: true,
            lastSyncedAt: new Date().toISOString(),
          }
          setSheetConfig(updatedConfig)
          localStorage.setItem('fl_sheet_config', JSON.stringify(updatedConfig))
          const label = liveTitle || 'Google Sheet'
          const billsCount = billsRes && Array.isArray(billsRes.bills) ? billsRes.bills.length : bills.length
          if (res.entries.length === 0 && pingRes?.sheets && pingRes.sheets.some((s: string) => /^[0-9]{4}-[0-9]{1,2}$/.test(s.trim()))) {
            setSyncStatus(`Connected to "${label}", but 0 entries returned. Please redeploy Apps Script (Deploy > Manage deployments > Edit > New version).`)
          } else {
            setSyncStatus(`Synced ${res.entries.length} entries & ${billsCount} bills from "${label}"`)
          }
        } else {
          setSyncStatus(res.error || res.message || 'Sync failed. Check Apps Script URL.')
        }
      } catch (err) {
        setSyncStatus(`Sync error: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setSyncing(false)
        setTimeout(() => setSyncStatus(null), 4000)
      }
    },
    [activeSheetUrl, sheetConfig.sheetName, bills.length]
  )

  // Switch active Google Sheet
  const handleSwitchSheet = (newUrl: string) => {
    if (!newUrl || newUrl === activeSheetUrl) return
    setActiveSheetUrl(newUrl)
    localStorage.setItem('fl_active_sheet_url', newUrl)

    const sheetObj = availableSheets.find((s) => s.url === newUrl)
    const updatedConfig: SheetConfig = {
      webAppUrl: newUrl,
      sheetName: sheetObj?.name,
      isConnected: true,
      lastSyncedAt: new Date().toISOString(),
    }
    setSheetConfig(updatedConfig)
    localStorage.setItem('fl_sheet_config', JSON.stringify(updatedConfig))

    // 1. Immediately display cached entries and bills for this sheet (zero delay)
    const cached = loadSheetEntriesCache(newUrl)
    setEntries(cached)
    const cachedBills = loadSheetBillsCache(newUrl)
    setBills(cachedBills)

    // 2. Fetch fresh entries & bills from the selected sheet
    handleSyncWithGoogleSheets(newUrl)
  }

  // Handle sync/record new bill from Challan Modal
  const handleSyncBill = async (bill: BillItem): Promise<boolean> => {
    // 1. Prepend to local state and cache immediately
    const updated = [bill, ...bills.filter((b) => b.billId !== bill.billId)]
    saveBillsCache(updated, activeSheetUrl)

    // 2. Append to connected Google Sheets tab 'Bills'
    if (activeSheetUrl && sheetConfig.isConnected) {
      try {
        const res = await googleSheetsApi.addBill(activeSheetUrl, bill)
        if (!res.success) {
          console.warn('Google Sheets addBill warning:', res.error || res.message)
        }
      } catch (err) {
        console.error('Failed to sync bill to Google Sheets:', err)
      }
    }
    return true
  }

  // Handle update bill status / payment from BillDetailModal
  const handleUpdateBill = async (updatedBill: BillItem): Promise<boolean> => {
    // 1. Update local state and cache immediately
    const updated = bills.map((b) => (b.billId === updatedBill.billId ? updatedBill : b))
    saveBillsCache(updated, activeSheetUrl)

    // 2. Update connected Google Sheets tab 'Bills'
    if (activeSheetUrl && sheetConfig.isConnected) {
      try {
        const res = await googleSheetsApi.updateBill(activeSheetUrl, updatedBill)
        return Boolean(res.success)
      } catch (err) {
        console.error('Failed to update bill in Google Sheets:', err)
        return false
      }
    }
    return true
  }

  // Initial sync when connected and user is logged in
  useEffect(() => {
    if (currentUser && activeSheetUrl && sheetConfig.isConnected && entries.length === 0) {
      handleSyncWithGoogleSheets(activeSheetUrl)
    }
  }, [currentUser, activeSheetUrl, sheetConfig.isConnected, entries.length, handleSyncWithGoogleSheets])


  // Login handler - persists credentials across sessions until explicit logout or password change
  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user)
    try {
      localStorage.setItem('fl_auth_user', JSON.stringify(user))
      sessionStorage.setItem('fl_auth_user', JSON.stringify(user))
    } catch {
      // ignore storage error
    }
    if (sheetConfig.webAppUrl && sheetConfig.isConnected) {
      handleSyncWithGoogleSheets()
    }
  }

  // Logout handler - explicitly removes stored credentials
  const handleLogout = useCallback(() => {
    setCurrentUser(null)
    try {
      localStorage.removeItem('fl_auth_user')
      sessionStorage.removeItem('fl_auth_user')
    } catch {
      // ignore
    }
    setMobileNavOpen(false)
  }, [])

  // Auto-verify stored credentials in background against Google Sheets
  // If the user's password was changed in Google Sheets, automatically prompt for re-authentication
  useEffect(() => {
    if (!currentUser?.credentialHash || !sheetConfig.webAppUrl || !sheetConfig.isConnected) return

    let isSubscribed = true
    try {
      const decoded = atob(currentUser.credentialHash)
      const colonIdx = decoded.indexOf(':')
      if (colonIdx > 0) {
        const uname = decoded.slice(0, colonIdx)
        const pwd = decoded.slice(colonIdx + 1)
        googleSheetsApi.login(sheetConfig.webAppUrl, uname, pwd).then((res) => {
          if (!isSubscribed) return
          if (!res.success) {
            console.warn('Session credentials rejected: password may have changed in Google Sheets.')
            handleLogout()
            alert('Your password or user credentials have changed in Google Sheets. Please sign in again.')
          }
        }).catch(() => {
          // Network offline / slow connection: keep session active
        })
      }
    } catch {
      // ignore
    }

    return () => {
      isSubscribed = false
    }
  }, [currentUser?.credentialHash, sheetConfig.webAppUrl, sheetConfig.isConnected, handleLogout])

  // Custom clients & projects persistence
  const [customClients, setCustomClients] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('fl_custom_clients')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // ignore
    }
    return []
  })

  const [customProjects, setCustomProjects] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('fl_custom_projects')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed)) return parsed
      }
    } catch {
      // ignore
    }
    return []
  })


  // Add new session entry
  const handleSaveEntry = async (newEntryData: Omit<SessionEntry, 'id'>) => {
    if (currentUser?.role !== 'admin') {
      alert('Only users with Admin role can log new entries.')
      return
    }

    setSavingEntry(true)
    const newEntry: SessionEntry = {
      ...newEntryData,
      id: `entry-${Date.now()}`,
      createdAt: new Date().toISOString(),
    }

    // Persist new client and project in custom list
    if (newEntry.client && !customClients.includes(newEntry.client)) {
      const updatedClients = [...customClients, newEntry.client]
      setCustomClients(updatedClients)
      localStorage.setItem('fl_custom_clients', JSON.stringify(updatedClients))
    }
    if (newEntry.project && !customProjects.includes(newEntry.project)) {
      const updatedProjects = [...customProjects, newEntry.project]
      setCustomProjects(updatedProjects)
      localStorage.setItem('fl_custom_projects', JSON.stringify(updatedProjects))
    }

    // Try posting to Google Sheets if connected
    if (activeSheetUrl && sheetConfig.isConnected) {
      try {
        const res = await googleSheetsApi.addEntry(activeSheetUrl, newEntry)
        if (!res.success) {
          console.warn('Google Sheets append response:', res.error || res.message)
        }
      } catch (err) {
        console.error('Failed to append to Google Sheets:', err)
      }
    }

    // Always update local entries for the active sheet
    saveEntriesCache([newEntry, ...entries], activeSheetUrl)
    setSavingEntry(false)
    setShowAddModal(false)
  }

  // Distinct clients and projects for filters and suggestions (auto-populated from Google Sheets + defaults)
  const clientsList = useMemo(() => {
    const set = new Set<string>()
    set.add('Jahnavi M')
    customClients.forEach((c) => c && set.add(c))
    entries.forEach((e) => e.client && set.add(e.client))
    return Array.from(set).sort()
  }, [entries, customClients])

  const projectsList = useMemo(() => {
    const set = new Set<string>()
    set.add('Dolby')
    set.add('Equinix')
    customProjects.forEach((p) => p && set.add(p))
    entries.forEach((e) => e.project && set.add(e.project))
    return Array.from(set).sort()
  }, [entries, customProjects])



  // Filtered entries
  const filteredEntries = useMemo(() => {
    if (!Array.isArray(entries)) return []

    return entries.filter((entry) => {
      if (!entry) return false

      const entryClient = String(entry.client || '').trim()
      const entryProject = String(entry.project || '').trim()
      const entryDesc = String(entry.description || '').trim()
      const entryDate = String(entry.date || '').trim()

      // Client filter: search mode (contains search) or exact select
      if (isClientSearchMode) {
        if (clientSearchText.trim()) {
          const cTarget = clientSearchText.toLowerCase().trim()
          if (!entryClient.toLowerCase().includes(cTarget)) {
            return false
          }
        }
      } else if (selectedClient && selectedClient !== 'All clients') {
        if (entryClient.toLowerCase() !== selectedClient.toLowerCase().trim()) {
          return false
        }
      }

      // Project filter: search mode (contains search) or exact select
      if (isProjectSearchMode) {
        if (projectSearchText.trim()) {
          const pTarget = projectSearchText.toLowerCase().trim()
          if (!entryProject.toLowerCase().includes(pTarget)) {
            return false
          }
        }
      } else if (selectedProject && selectedProject !== 'All projects') {
        if (entryProject.toLowerCase() !== selectedProject.toLowerCase().trim()) {
          return false
        }
      }

      // Search query across client, project, description
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const text = `${entryClient} ${entryProject} ${entryDesc}`.toLowerCase()
        if (!text.includes(q)) return false
      }

      // Period filter
      if (period === 'Today') {
        return entryDate === today
      }

      if (period === 'This month') {
        return entryDate.startsWith(today.slice(0, 7))
      }

      if (period === 'This week') {
        if (!entryDate) return false
        const eDate = new Date(`${entryDate}T12:00:00`)
        const curr = new Date(`${today}T12:00:00`)
        const firstDay = new Date(curr)
        firstDay.setDate(curr.getDate() - ((curr.getDay() + 6) % 7))
        const lastDay = new Date(firstDay)
        lastDay.setDate(firstDay.getDate() + 7)
        return eDate >= firstDay && eDate < lastDay
      }

      if (period === 'Custom') {
        return entryDate >= customStartDate && entryDate <= customEndDate
      }

      return true // 'All time'
    })
  }, [
    entries,
    selectedClient,
    isClientSearchMode,
    clientSearchText,
    selectedProject,
    isProjectSearchMode,
    projectSearchText,
    searchQuery,
    period,
    today,
    customStartDate,
    customEndDate,
  ])

  // Summary Totals
  const totals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => {
        acc.totalMinutes += Number(entry.totalMinutes) || 0
        acc.discountMinutes += Number(entry.discountMinutes) || 0
        acc.effectiveMinutes += Number(entry.effectiveMinutes) || 0
        acc.grossMoney += Number(entry.moneyWithoutDiscount) || 0
        acc.discountMoney += Number(entry.discountMoney) || 0
        acc.netMoney += Number(entry.moneyWithDiscount) || 0
        return acc
      },
      {
        totalMinutes: 0,
        discountMinutes: 0,
        effectiveMinutes: 0,
        grossMoney: 0,
        discountMoney: 0,
        netMoney: 0,
      }
    )
  }, [filteredEntries])

  // September 2026 Cutoff Payment Settlement Calculation
  // By policy: all earnings prior to 2026-10-01 (Sept 2026 and earlier) are 100% Settled / Paid by default
  // From October 2026 onwards, settlements and receivables track dynamically via the Bills tab
  const settlementMetrics = useMemo(() => {
    const preOctoberNet = filteredEntries
      .filter((e) => e.date < '2026-10-01')
      .reduce((acc, e) => acc + (Number(e.moneyWithDiscount) || 0), 0)

    const postSeptemberNet = filteredEntries
      .filter((e) => e.date >= '2026-10-01')
      .reduce((acc, e) => acc + (Number(e.moneyWithDiscount) || 0), 0)

    let billsPaid = 0
    let billsPending = 0
    bills.forEach((b) => {
      const net = Number(b.netAmount) || 0
      if (b.status === 'Fully Paid') {
        billsPaid += b.paidAmount || net
      } else if (b.status === 'Half Paid') {
        const paid = Number(b.paidAmount) || 0
        billsPaid += paid
        billsPending += Math.max(0, net - paid)
      } else {
        billsPending += net
      }
    })

    const totalSettledPaid = preOctoberNet + billsPaid
    const totalPendingDue = billsPending + Math.max(0, postSeptemberNet - (billsPaid + billsPending))

    return {
      preOctoberNet,
      postSeptemberNet,
      billsPaid,
      billsPending,
      totalSettledPaid,
      totalPendingDue,
    }
  }, [filteredEntries, bills])

  // Daily, Weekly and Monthly Aggregations
  const dailySummaries = useMemo(() => groupSessionsByDay(filteredEntries), [filteredEntries])
  const weeklySummaries = useMemo(() => groupSessionsByWeek(filteredEntries), [filteredEntries])
  const monthlySummaries = useMemo(() => groupSessionsByMonth(filteredEntries), [filteredEntries])

  // Average Hourly Rate for Customer KPI
  const avgHourlyRate = useMemo(() => {
    if (filteredEntries.length === 0) return 0
    const sum = filteredEntries.reduce((acc, e) => acc + (Number(e.rate) || 0), 0)
    return Math.round(sum / filteredEntries.length)
  }, [filteredEntries])

  // Full Name of logged in user
  const userFullName = useMemo(() => {
    if (!currentUser) return 'User'
    if (currentUser.fullName) return currentUser.fullName
    if (currentUser.name) return currentUser.name
    if (currentUser.role === 'admin' || currentUser.username.toLowerCase() === 'admin') {
      return 'Satish Gaikwad'
    }
    if (currentUser.username.toLowerCase() === 'viewer') {
      return 'Client Viewer'
    }
    return currentUser.username
  }, [currentUser])

  // Dynamic Greeting based on current time of day and user role
  const greetingInfo = useMemo(() => {
    const hour = new Date().getHours()
    let timeGreeting = 'Hello'
    let icon = '👋'

    if (hour >= 5 && hour < 12) {
      timeGreeting = 'Good morning'
      icon = '☀️'
    } else if (hour >= 12 && hour < 17) {
      timeGreeting = 'Good afternoon'
      icon = '🌤️'
    } else if (hour >= 17 && hour < 22) {
      timeGreeting = 'Good evening'
      icon = '🌆'
    } else {
      timeGreeting = 'Good evening'
      icon = '🌙'
    }

    const fullGreeting = `${timeGreeting}, ${userFullName}`

    let dynamicMessage = ''
    if (isAdmin) {
      if (hour < 12) {
        dynamicMessage = `Ready to manage today's ServiceNow support sessions and track client billables.`
      } else if (hour < 17) {
        dynamicMessage = `Overview of your daytime ServiceNow support workloads, entries, and sheet synchronizations.`
      } else {
        dynamicMessage = `Wrap up your daily ServiceNow support sessions and generate client statements.`
      }
    } else {
      if (hour < 12) {
        dynamicMessage = `Welcome to your ServiceNow support workspace. Here is your daily session breakdown.`
      } else if (hour < 17) {
        dynamicMessage = `Here is your afternoon overview of ServiceNow support hours and project progress.`
      } else {
        dynamicMessage = `Summary of your logged ServiceNow support hours and session history.`
      }
    }

    return {
      timeGreeting,
      icon,
      fullGreeting,
      dynamicMessage,
    }
  }, [currentUser, isAdmin])

  // Excel (.xlsx) Multi-Sheet Export (excludes earned money for Customer)
  const handleExportExcel = () => {
    const workbook = XLSX.utils.book_new()

    // 1. Sessions Ledger Sheet
    const ledgerRows = filteredEntries.map((e) => {
      const base: Record<string, unknown> = {
        Date: e.date,
        'Start Time': e.startTime,
        'End Time': e.endTime,
        'Total Time': formatMinutes(e.totalMinutes),
        'Total Minutes': e.totalMinutes,
        'Discount (Mins)': e.discountMinutes,
        'Effective Time': formatMinutes(e.effectiveMinutes),
        'Effective Minutes': e.effectiveMinutes,
        'Rate (INR/hr)': e.rate,
        Client: e.client,
        Project: e.project,
        Description: e.description,
      }
      if (isAdmin) {
        base['Gross Money without Discount (INR)'] = Math.round(e.moneyWithoutDiscount)
        base['Discount in Money (INR)'] = Math.round(e.discountMoney)
        base['Net Final Money with Discount (INR)'] = Math.round(e.moneyWithDiscount)
      }
      return base
    })
    const ledgerSheet = XLSX.utils.json_to_sheet(ledgerRows)
    XLSX.utils.book_append_sheet(workbook, ledgerSheet, 'Sessions Ledger')

    // 2. Daily Summary Sheet
    const dailyRows = dailySummaries.map((d) => {
      const base: Record<string, unknown> = {
        Date: d.date,
        'Sessions Count': d.sessionsCount,
        'Total Time': formatMinutes(d.totalMinutes),
        'Discount Time': formatMinutes(d.discountMinutes),
        'Effective Time': formatMinutes(d.effectiveMinutes),
      }
      if (isAdmin) {
        base['Gross Money (INR)'] = Math.round(d.moneyWithoutDiscount)
        base['Discount Money (INR)'] = Math.round(d.discountMoney)
        base['Net Final Money (INR)'] = Math.round(d.finalMoney)
      }
      return base
    })
    const dailySheet = XLSX.utils.json_to_sheet(dailyRows)
    XLSX.utils.book_append_sheet(workbook, dailySheet, 'Daily Summary')

    // 3. Weekly Summary Sheet
    const weeklyRows = weeklySummaries.map((w) => {
      const base: Record<string, unknown> = {
        Week: w.weekLabel,
        'Working Days': w.daysCount,
        'Total Sessions': w.totalSessions,
        'Total Time': formatMinutes(w.totalMinutes),
        'Discount Time': formatMinutes(w.discountMinutes),
        'Effective Time': formatMinutes(w.effectiveMinutes),
        Clients: w.uniqueClients.join(', '),
      }
      if (isAdmin) {
        base['Gross Money (INR)'] = Math.round(w.moneyWithoutDiscount)
        base['Discount Money (INR)'] = Math.round(w.discountMoney)
        base['Net Final Money (INR)'] = Math.round(w.finalMoney)
      }
      return base
    })
    const weeklySheet = XLSX.utils.json_to_sheet(weeklyRows)
    XLSX.utils.book_append_sheet(workbook, weeklySheet, 'Weekly Summary')

    // 4. Monthly Summary Sheet
    const monthlyRows = monthlySummaries.map((m) => {
      const base: Record<string, unknown> = {
        'Month (YYYY-MM)': m.monthKey,
        'Month Name': m.monthName,
        'Working Days': m.daysCount,
        'Total Sessions': m.totalSessions,
        'Total Time': formatMinutes(m.totalMinutes),
        'Effective Time': formatMinutes(m.effectiveMinutes),
        Clients: m.uniqueClients.join(', '),
      }
      if (isAdmin) {
        base['Gross Money (INR)'] = Math.round(m.moneyWithoutDiscount)
        base['Discount Money (INR)'] = Math.round(m.discountMoney)
        base['Net Final Money (INR)'] = Math.round(m.finalMoney)
      }
      return base
    })
    const monthlySheet = XLSX.utils.json_to_sheet(monthlyRows)
    XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Monthly Summary')

    XLSX.writeFile(workbook, `satish-servicenow-support-ledger-${today}.xlsx`)
  }

  // PDF Report Export (excludes earned money for Customer)
  const handleExportPdf = () => {
    const doc = new jsPDF()

    doc.setFillColor(15, 107, 97)
    doc.rect(0, 0, 210, 24, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(15)
    doc.setFont('helvetica', 'bold')
    doc.text(isAdmin ? 'SATISH SERVICENOW SUPPORT - TIME & BILLING REPORT' : 'SATISH SERVICENOW SUPPORT - WORK SESSIONS REPORT', 14, 16)

    const clientLabel = isClientSearchMode
      ? `Client: "${clientSearchText || 'Any'}"`
      : `Client: ${selectedClient}`
    const projectLabel = isProjectSearchMode
      ? `Project: "${projectSearchText || 'Any'}"`
      : `Project: ${selectedProject}`
    const periodLabel = period === 'Custom' ? `Period: Custom (${customStartDate} to ${customEndDate})` : `Period: ${period}`
    const searchFilterStr = searchQuery ? `Search: "${searchQuery}"` : null
    const appliedFilters = [periodLabel, clientLabel, projectLabel, searchFilterStr].filter(Boolean).join(' | ')

    doc.setTextColor(50, 60, 55)
    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.text(
      `Filters Applied: ${appliedFilters} | Sessions: ${filteredEntries.length} | Generated: ${new Date().toLocaleDateString('en-IN')}`,
      14,
      32
    )
    if (isAdmin) {
      doc.text(
        `Effective Hours: ${formatMinutes(totals.effectiveMinutes)} | Gross: ${formatRupees(totals.grossMoney)} | Net: ${formatRupees(totals.netMoney)} | Settled (Paid): ${formatRupees(settlementMetrics.totalSettledPaid)} | Pending Due: ${formatRupees(settlementMetrics.totalPendingDue)}`,
        14,
        38
      )
    } else {
      doc.text(
        `Effective Hours: ${formatMinutes(totals.effectiveMinutes)} | Total Duration: ${formatMinutes(totals.totalMinutes)} | Time Discount: -${formatMinutes(totals.discountMinutes)}`,
        14,
        38
      )
    }

    const tableRows = filteredEntries.map((e) => {
      const row = [
        e.date,
        e.client,
        e.project,
        `${e.startTime}-${e.endTime}`,
        formatMinutes(e.totalMinutes),
        e.discountMinutes ? `-${formatMinutes(e.discountMinutes)}` : '0m',
        formatMinutes(e.effectiveMinutes),
        `Rs. ${e.rate}`,
      ]
      if (isAdmin) {
        row.push(`Rs. ${Math.round(e.moneyWithDiscount).toLocaleString('en-IN')}`)
      }
      return row
    })

    const headers = [
      'Date',
      'Client',
      'Project',
      'Timing',
      'Total',
      'Disc.',
      'Effective',
      'Rate/hr',
    ]
    if (isAdmin) {
      headers.push('Net (INR)')
    }

    autoTable(doc, {
      startY: 44,
      head: [headers],
      body: tableRows,
      headStyles: { fillColor: [15, 107, 97], fontSize: 8 },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: isAdmin ? { 8: { halign: 'right' } } : {},
    })

    doc.save(`satish-servicenow-support-report-${today}.pdf`)
  }

  // If user is not logged in, show Login Modal (MANDATORY per session)
  if (!currentUser) {
    return (
      <div className="app-shell" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <LoginModal
          sheetConfig={sheetConfig}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    )
  }

  return (
    <div className="app-shell">
      {/* Mobile Drawer Overlay */}
      <div
        className={`sidebar-overlay ${mobileNavOpen ? 'show' : ''}`}
        onClick={() => setMobileNavOpen(false)}
      />

      {/* SIDEBAR NAVIGATION */}
      <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div className="brand">
            <span className="brand-mark">₹</span>
            <span>Satish Servicenow Support</span>
          </div>
          <button
            className="icon-btn mobile-close-btn"
            onClick={() => setMobileNavOpen(false)}
            title="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Card */}
        <div className="user-status-card">
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong
              title={userFullName}
              style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}
            >
              {userFullName}
            </strong>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
              <span className={`role-badge ${currentUser.role}`}>
                {isAdmin ? 'Admin' : 'Customer'}
              </span>
              {currentUser.username && userFullName.toLowerCase() !== currentUser.username.toLowerCase() && (
                <span style={{ fontSize: '11px', color: '#68776d' }}>@{currentUser.username}</span>
              )}
            </div>
          </div>
          <button
            className="icon-btn"
            title="Sign out of session"
            onClick={handleLogout}
            style={{ width: '28px', height: '28px' }}
          >
            <LogOut size={15} />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="nav-list">
          <p className="nav-label">Workspace Views</p>
          <button
            className={`nav-item ${activeView === 'ledger' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('ledger')
              setMobileNavOpen(false)
            }}
          >
            <TableProperties size={17} /> Sessions Ledger
            <span className="nav-badge">{entries.length}</span>
          </button>

          <button
            className={`nav-item ${activeView === 'daily' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('daily')
              setMobileNavOpen(false)
            }}
          >
            <CalendarDays size={17} /> Daily Breakdown
          </button>

          <button
            className={`nav-item ${activeView === 'weekly' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('weekly')
              setMobileNavOpen(false)
            }}
          >
            <CalendarRange size={17} /> Weekly Breakdown
          </button>

          <button
            className={`nav-item ${activeView === 'monthly' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('monthly')
              setMobileNavOpen(false)
            }}
          >
            <Layers size={17} /> Monthly Summary
          </button>

          <button
            className={`nav-item ${activeView === 'analytics' ? 'active' : ''}`}
            onClick={() => {
              setActiveView('analytics')
              setMobileNavOpen(false)
            }}
          >
            <BarChart3 size={17} /> Analytics Dashboard
          </button>

          {isAdmin && (
            <button
              className={`nav-item ${activeView === 'bills' ? 'active' : ''}`}
              onClick={() => {
                setActiveView('bills')
                setMobileNavOpen(false)
              }}
            >
              <Receipt size={17} /> Bills &amp; Invoices
              <span className="nav-badge">{bills.length}</span>
            </button>
          )}

          {isAdmin && (
            <>
              <p className="nav-label spaced">Billing &amp; Tools</p>
              <button
                className="nav-item"
                onClick={() => {
                  setShowChallanModal(true)
                  setMobileNavOpen(false)
                }}
              >
                <FileText size={17} /> Generate Challan
              </button>

              <button
                className="nav-item"
                onClick={() => {
                  setShowSheetModal(true)
                  setMobileNavOpen(false)
                }}
              >
                <Settings size={17} /> Sheets Integration
              </button>
            </>
          )}
        </nav>

        {/* Sidebar Bottom Sync Status */}
        <div className="sidebar-bottom">
          <div
            className="sync-card"
            onClick={() => {
              if (isAdmin) setShowSheetModal(true)
            }}
            style={{ cursor: isAdmin ? 'pointer' : 'default' }}
            title={isAdmin ? "Click to view Google Sheets Integration details" : "Connected Google Sheet"}
          >
            <div className={`sync-icon ${sheetConfig.isConnected ? 'online' : 'offline'}`}>
              <RefreshCw size={14} className={syncing ? 'spin-icon' : ''} />
            </div>
            <div>
              <strong>{availableSheets.find((s) => s.url === activeSheetUrl)?.name || 'Google Sheet'}</strong>
              <small>
                {sheetConfig.isConnected
                  ? sheetConfig.lastSyncedAt
                    ? `Synced ${new Date(sheetConfig.lastSyncedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                    : 'Connected'
                  : 'Not Connected'}
              </small>
            </div>
          </div>

          {isAdmin && (
            <button
              className="help-link"
              onClick={() => setShowSheetModal(true)}
            >
              <Sparkles size={15} color="#0f6b61" /> Setup Instructions
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-content">
        {/* Top Header Bar */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="icon-btn mobile-menu-toggle"
              onClick={() => setMobileNavOpen(true)}
              title="Open Navigation"
            >
              <Menu size={18} />
            </button>

            <div className="breadcrumb">
              Workspace <span>/</span>{' '}
              <strong>
                {activeView === 'ledger' && 'Sessions Ledger'}
                {activeView === 'daily' && 'Daily Multi-Session Breakdown'}
                {activeView === 'weekly' && 'Weekly Workload Breakdown'}
                {activeView === 'monthly' && 'Monthly Aggregations'}
                {activeView === 'analytics' && 'Analytics & Visual Insights'}
                {activeView === 'bills' && 'Bills & Invoices Register'}
              </strong>
            </div>
          </div>

          {/* Active Sheet Selector Dropdown in Header (Visible to both Admin and Customer) */}
          <div className="header-sheet-selector">
            <div
              className="sheet-selector-badge"
              title="Active Google Sheet. All operations apply to this sheet."
            >
              <FileSpreadsheet size={16} className="sheet-badge-icon" />
              <div className="sheet-selector-info">
                <span className="sheet-selector-caption">Sheet</span>
                <select
                  className="header-sheet-dropdown"
                  value={activeSheetUrl}
                  onChange={(e) => {
                    if (e.target.value === '__manage__') {
                      setShowSheetModal(true)
                    } else {
                      handleSwitchSheet(e.target.value)
                    }
                  }}
                  disabled={syncing}
                >
                  {availableSheets.map((s, idx) => (
                    <option key={s.url} value={s.url}>
                      {s.name || `Sheet ${idx + 1}`} {s.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                  {isAdmin && (
                    <option value="__manage__">⚙️ Manage Sheets / Add URL...</option>
                  )}
                </select>
              </div>
              <span
                className={`sheet-live-indicator ${sheetConfig.isConnected ? 'online' : 'offline'}`}
                title={sheetConfig.isConnected ? 'Connected & Synced' : 'Offline'}
              />
            </div>
          </div>

          <div className="top-actions">
            {sheetConfig.isConnected && (
              <button
                className="secondary-btn"
                onClick={() => handleSyncWithGoogleSheets(activeSheetUrl)}
                disabled={syncing}
                title="Fetch updated data from Google Sheets"
              >
                <RefreshCw size={14} className={syncing ? 'spin-icon' : ''} />
                <span className="btn-text-responsive">{syncing ? 'Syncing...' : 'Sync Sheet'}</span>
              </button>
            )}

            {isAdmin ? (
              <button
                className="primary-btn"
                onClick={() => setShowAddModal(true)}
              >
                <Plus size={16} /> <span className="btn-text-responsive">Log Work Session</span>
              </button>
            ) : (
              <div className="customer-tag-pill" title="Read-only access. Entry creation and total money are restricted.">
                <Eye size={13} />
                <span>Customer View</span>
              </div>
            )}

            {/* Logged in User Profile Pill in Topbar */}
            <div
              className="topbar-user-badge"
              title={`Logged in as ${userFullName} (${isAdmin ? 'Administrator' : 'Customer View'})`}
            >
              <div className="user-avatar-circle">
                {userFullName.charAt(0).toUpperCase()}
              </div>
              <div className="topbar-user-info">
                <span className="user-fullname-text">{userFullName}</span>
                <span className="user-role-subtext">{isAdmin ? 'Admin' : 'Customer'}</span>
              </div>
            </div>

            <button
              className="icon-btn logout-topbar-btn"
              onClick={handleLogout}
              title="Sign Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        <div className="content-wrap">
          {/* Read Access Notification if role !== admin */}
          {!isAdmin && (
            <div className="read-access-banner">
              <ShieldCheck size={16} />
              <span>
                <b>Customer Portal Mode:</b> Welcome, <b>{userFullName}</b>! You are logged in with view-only permissions. You can inspect all work sessions, daily, weekly, and monthly summaries, see hourly rates, and export work logs. Financial totals and entry creation are restricted to Administrator view.
              </span>
            </div>
          )}

          {/* Sync notification message banner if any */}
          {syncStatus && (
            <div className="alert-box success" style={{ marginBottom: '18px' }}>
              <RefreshCw size={14} />
              <span>{syncStatus}</span>
            </div>
          )}

          {/* Heading Section */}
          <section className="page-heading">
            <div>
              <div className="eyebrow-container">
                <span className="greeting-pill">
                  <span className="greeting-icon">{greetingInfo.icon}</span>
                  <strong>{greetingInfo.fullGreeting}!</strong>
                </span>
                <span className="eyebrow-dot">•</span>
                <p className="eyebrow">
                  {new Date().toLocaleDateString('en-IN', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <h1>Satish Servicenow Support</h1>
              <p className="subheading">
                {greetingInfo.dynamicMessage}
              </p>
            </div>
          </section>

          {/* SUMMARY CARDS (KPIs) - Role-Aware (Excludes earned money for Customer) */}
          {activeView !== 'analytics' && activeView !== 'bills' && (
            <section className="summary-grid">
              <div className="summary-card highlight">
                <div className="card-top">
                  <span className="card-label">Effective Time</span>
                  <Clock size={16} color="#d4f0e4" />
                </div>
                <strong>{formatMinutes(totals.effectiveMinutes)}</strong>
                <small style={{ color: '#c7e8dc' }}>
                  {(totals.effectiveMinutes / 60).toFixed(1)} billable hrs after discounts
                </small>
              </div>

              <div className="summary-card">
                <div className="card-top">
                  <span className="card-label">Total Work Duration</span>
                  <span className="card-icon orange">
                    <Clock size={16} />
                  </span>
                </div>
                <strong>{formatMinutes(totals.totalMinutes)}</strong>
                <small style={{ color: '#88948c' }}>
                  Discount deducted: -{formatMinutes(totals.discountMinutes)}
                </small>
              </div>

              {isAdmin ? (
                <div className="summary-card">
                  <div className="card-top">
                    <span className="card-label">Net Final Earnings</span>
                    <span className="card-icon green">
                      <IndianRupee size={16} />
                    </span>
                  </div>
                  <strong style={{ color: '#0f6b61' }}>{formatRupees(totals.netMoney)}</strong>
                  <div style={{ display: 'flex', gap: '5px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        background: '#dcfce7',
                        color: '#166534',
                        padding: '2px 7px',
                        borderRadius: '4px',
                      }}
                      title="Pre-October 2026 earnings are 100% settled. October 2026+ verified via Bills sheet."
                    >
                      Paid: {formatRupees(settlementMetrics.totalSettledPaid)}
                    </span>
                    {settlementMetrics.totalPendingDue > 0 && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          background: '#fef3c7',
                          color: '#b45309',
                          padding: '2px 7px',
                          borderRadius: '4px',
                        }}
                        title="October 2026+ challan bills awaiting settlement"
                      >
                        Due: {formatRupees(settlementMetrics.totalPendingDue)}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="summary-card">
                  <div className="card-top">
                    <span className="card-label">Hourly Rate</span>
                    <span className="card-icon green">
                      <IndianRupee size={16} />
                    </span>
                  </div>
                  <strong style={{ color: '#0f6b61' }}>₹{avgHourlyRate}/hr</strong>
                  <small style={{ color: '#88948c' }}>
                    Average rate across {new Set(filteredEntries.map((e) => e.client)).size} clients
                  </small>
                </div>
              )}

              <div className="summary-card">
                <div className="card-top">
                  <span className="card-label">Logged Sessions</span>
                  <span className="card-icon blue">
                    <LayoutDashboard size={16} />
                  </span>
                </div>
                <strong>{filteredEntries.length}</strong>
                <small style={{ color: '#88948c' }}>
                  Across {new Set(filteredEntries.map((e) => e.client)).size} clients
                </small>
              </div>
            </section>
          )}

          {/* TOOLBAR & FILTERS */}
          <section className="toolbar">
            {/* View Switcher Tabs */}
            <div className="view-tabs">
              <button
                className={`view-tab-btn ${activeView === 'ledger' ? 'selected' : ''}`}
                onClick={() => setActiveView('ledger')}
              >
                <TableProperties size={15} /> All Sessions
              </button>
              <button
                className={`view-tab-btn ${activeView === 'daily' ? 'selected' : ''}`}
                onClick={() => setActiveView('daily')}
              >
                <CalendarDays size={15} /> Daily Breakdown ({dailySummaries.length})
              </button>
              <button
                className={`view-tab-btn ${activeView === 'weekly' ? 'selected' : ''}`}
                onClick={() => setActiveView('weekly')}
              >
                <CalendarRange size={15} /> Weekly Breakdown ({weeklySummaries.length})
              </button>
              <button
                className={`view-tab-btn ${activeView === 'monthly' ? 'selected' : ''}`}
                onClick={() => setActiveView('monthly')}
              >
                <Layers size={15} /> Monthly Summary ({monthlySummaries.length})
              </button>
              <button
                className={`view-tab-btn ${activeView === 'analytics' ? 'selected' : ''}`}
                onClick={() => setActiveView('analytics')}
              >
                <BarChart3 size={15} /> Analytics Dashboard
              </button>
              {isAdmin && (
                <button
                  className={`view-tab-btn ${activeView === 'bills' ? 'selected' : ''}`}
                  onClick={() => setActiveView('bills')}
                >
                  <Receipt size={15} /> Bills &amp; Invoices ({bills.length})
                </button>
              )}
            </div>

            {/* Filter controls */}
            {activeView !== 'analytics' && activeView !== 'bills' && (
              <div className="toolbar-actions">
              {/* Period dropdown */}
              <select
                className="period-select"
                value={period}
                onChange={(e) => setPeriod(e.target.value as typeof period)}
              >
                <option value="All time">All Time</option>
                <option value="Today">Today</option>
                <option value="This week">This Week</option>
                <option value="This month">This Month</option>
                <option value="Custom">Custom Range</option>
              </select>

              {/* Custom Date Range inputs */}
              {period === 'Custom' && (
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <input
                    type="date"
                    className="period-select"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                  />
                  <span style={{ fontSize: '11px', color: '#88948c' }}>to</span>
                  <input
                    type="date"
                    className="period-select"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                  />
                </div>
              )}

              {/* Client filter: dropdown with search option OR string search input */}
              {!isClientSearchMode ? (
                <select
                  className="client-select"
                  value={selectedClient}
                  onChange={(e) => handleClientSelectChange(e.target.value)}
                >
                  <option value="All clients">All Clients ({clientsList.length})</option>
                  {clientsList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__search__">🔍 Search client by name...</option>
                </select>
              ) : (
                <div className="filter-inline-search">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Type client name..."
                    value={clientSearchText}
                    onChange={(e) => setClientSearchText(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={handleResetClientSearch}
                    title="Back to dropdown"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Project filter: dropdown with search option OR string search input */}
              {!isProjectSearchMode ? (
                <select
                  className="client-select"
                  value={selectedProject}
                  onChange={(e) => handleProjectSelectChange(e.target.value)}
                >
                  <option value="All projects">All Projects ({projectsList.length})</option>
                  {projectsList.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  <option value="__search__">🔍 Search project by name...</option>
                </select>
              ) : (
                <div className="filter-inline-search">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Type project name..."
                    value={projectSearchText}
                    onChange={(e) => setProjectSearchText(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={handleResetProjectSearch}
                    title="Back to dropdown"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}

              {/* Challan Trigger (Admin Only) */}
              {isAdmin && (
                <button
                  className="secondary-btn"
                  onClick={() => setShowChallanModal(true)}
                  title="Create client invoice/challan for selected scope"
                >
                  <FileText size={15} /> Challan
                </button>
              )}
            </div>
            )}
          </section>

          {/* VIEW RENDERER */}
          {activeView === 'analytics' && (
            <AnalyticsView
              entries={entries}
              userRole={currentUser.role}
              availableClients={clientsList}
              availableProjects={projectsList}
              bills={bills}
            />
          )}

          {activeView === 'bills' && isAdmin && (
            <BillsView
              bills={bills}
              userRole={currentUser.role}
              sheetName={sheetConfig.sheetName}
              onUpdateBill={handleUpdateBill}
              onOpenCreateChallan={() => setShowChallanModal(true)}
              onRefreshBills={() => handleSyncWithGoogleSheets(activeSheetUrl)}
              isSyncing={syncing}
            />
          )}

          {activeView === 'daily' && (
            <DailyBreakdownView
              dailySummaries={dailySummaries}
              userRole={currentUser.role}
            />
          )}

          {activeView === 'weekly' && (
            <WeeklyBreakdownView
              weeklySummaries={weeklySummaries}
              userRole={currentUser.role}
            />
          )}

          {activeView === 'monthly' && (
            <MonthlyBreakdownView
              monthlySummaries={monthlySummaries}
              userRole={currentUser.role}
            />
          )}

          {activeView === 'ledger' && (
            <section className="ledger-section">
              <div className="section-header">
                <div>
                  <h2>Work Sessions Ledger</h2>
                  <p>All individual work logs with duration, discounts, and hourly rate.</p>
                </div>

                <div className="ledger-actions">
                  <div className="search-box">
                    <Search size={15} />
                    <input
                      placeholder="Search sessions..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="export-menu">
                    <button className="secondary-btn">
                      <Download size={15} /> Export
                    </button>
                    <div className="export-options">
                      <button onClick={handleExportExcel}>
                        <Upload size={14} /> Excel Spreadsheet (.xlsx)
                      </button>
                      <button onClick={handleExportPdf}>
                        <FileText size={14} /> PDF Report
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="table-wrap ledger-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Client / Project</th>
                      <th>Description</th>
                      <th>Timing</th>
                      <th>Total Time</th>
                      <th>Discount</th>
                      <th>Effective</th>
                      <th>Rate</th>
                      {isAdmin && <th style={{ textAlign: 'right' }}>Gross (No Disc.)</th>}
                      {isAdmin && <th style={{ textAlign: 'right' }}>Net Payable</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <strong>{entry.date}</strong>
                          <small>
                            {new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-IN', {
                              weekday: 'short',
                            })}
                          </small>
                        </td>
                        <td>
                          <strong>{entry.client}</strong>
                          <small>{entry.project}</small>
                        </td>
                        <td style={{ maxWidth: '240px', color: '#57655c' }}>
                          {entry.description}
                        </td>
                        <td>
                          <span className="timing-pill">
                            {entry.startTime} - {entry.endTime}
                          </span>
                        </td>
                        <td>{formatMinutes(entry.totalMinutes)}</td>
                        <td>
                          {entry.discountMinutes > 0 ? (
                            <span className="discount-pill">
                              -{entry.discountMinutes}m {isAdmin && `(${formatRupees(entry.discountMoney)})`}
                            </span>
                          ) : (
                            <span style={{ color: '#97a399' }}>—</span>
                          )}
                        </td>
                        <td>
                          <strong style={{ color: '#0f6b61' }}>
                            {formatMinutes(entry.effectiveMinutes)}
                          </strong>
                        </td>
                        <td>₹{entry.rate}/hr</td>
                        {isAdmin && (
                          <td className="gross-cell">
                            {formatRupees(entry.moneyWithoutDiscount)}
                          </td>
                        )}
                        {isAdmin && (
                          <td className="amount-cell">
                            {formatRupees(entry.moneyWithDiscount)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredEntries.length === 0 && (
                  <div className="empty-state">
                    <SlidersHorizontal size={34} color="#859288" />
                    <strong>No sessions found</strong>
                    <span>
                      {entries.length === 0
                        ? isAdmin
                          ? 'Your ledger is clean. Click "Log Work Session" to add your first entry or connect your Google Sheet.'
                          : 'No sessions recorded in this sheet yet.'
                        : 'No entries match your active filters. Try changing client, date, or search keywords.'}
                    </span>
                    {isAdmin && entries.length === 0 && (
                      <button
                        className="primary-btn"
                        style={{ marginTop: '12px' }}
                        onClick={() => setShowAddModal(true)}
                      >
                        <Plus size={16} /> Log First Session
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="table-footer">
                <span>
                  Showing {filteredEntries.length} of {entries.length} entries
                </span>
                <span>
                  {sheetConfig.isConnected ? (
                    <>
                      <span
                        style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#2e8b57',
                          marginRight: '6px',
                        }}
                      />
                      Synced with Google Sheets
                    </>
                  ) : (
                    <>
                      <span
                        style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: '#c57242',
                          marginRight: '6px',
                        }}
                      />
                      Local cache only
                    </>
                  )}
                </span>
              </div>
            </section>
          )}
        </div>
      </main>

      {/* MODALS */}

      {/* Add Entry Modal (Admin Only) */}
      {showAddModal && isAdmin && (
        <AddEntryModal
          onClose={() => setShowAddModal(false)}
          onSave={handleSaveEntry}
          existingClients={clientsList}
          existingProjects={projectsList}
          saving={savingEntry}
        />
      )}

      {/* Google Sheets Integration Guide & Setup Modal (Admin Only) */}
      {showSheetModal && isAdmin && (
        <GoogleSheetsModal
          config={sheetConfig}
          availableSheets={availableSheets}
          activeSheetUrl={activeSheetUrl}
          onSwitchSheet={handleSwitchSheet}
          onAddCustomSheet={(url, name) => {
            addCustomSheetUrl(url, name)
            setAvailableSheets(getAvailableSheets())
          }}
          onRemoveCustomSheet={(url) => {
            removeCustomSheetUrl(url)
            setAvailableSheets(getAvailableSheets())
          }}
          onSaveConfig={handleSaveSheetConfig}
          onClose={() => setShowSheetModal(false)}
          onSyncNow={() => handleSyncWithGoogleSheets(activeSheetUrl)}
        />
      )}

      {/* Client Challan / Invoice Modal (Admin Only) */}
      {showChallanModal && isAdmin && (
        <ChallanModal
          entries={entries}
          initialClient={selectedClient}
          onClose={() => setShowChallanModal(false)}
          onSyncBill={handleSyncBill}
        />
      )}

    </div>
  )
}
