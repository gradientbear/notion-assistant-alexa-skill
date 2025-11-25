'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import styles from './page.module.css'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
}

const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null

interface License {
  license_key: string
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  notes?: string
}

interface User {
  id: string
  email: string
  license_key: string
  amazon_account_id: string
  notion_token: string | null
  created_at: string
}

export default function AdminPage() {
  const [licenses, setLicenses] = useState<License[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'licenses' | 'users'>('licenses')
  
  // New license form
  const [newLicenseKey, setNewLicenseKey] = useState('')
  const [newLicenseNotes, setNewLicenseNotes] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    if (supabase) {
      loadData()
    }
  }, [])

  const loadData = async () => {
    if (!supabase) return
    
    setLoading(true)
    try {
      // Load licenses
      const { data: licensesData } = await supabase
        .from('licenses')
        .select('*')
        .order('created_at', { ascending: false })
      
      // Load users
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
      
      setLicenses(licensesData || [])
      setUsers(usersData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const addLicense = async () => {
    if (!supabase || !newLicenseKey.trim()) return

    try {
      const { error } = await supabase
        .from('licenses')
        .insert({
          license_key: newLicenseKey.trim(),
          status: 'active',
          notes: newLicenseNotes.trim() || null,
        })

      if (error) throw error

      setNewLicenseKey('')
      setNewLicenseNotes('')
      setShowAddForm(false)
      loadData()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const toggleLicenseStatus = async (licenseKey: string, currentStatus: string) => {
    if (!supabase) return

    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
      const { error } = await supabase
        .from('licenses')
        .update({ status: newStatus })
        .eq('license_key', licenseKey)

      if (error) throw error
      loadData()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const deleteLicense = async (licenseKey: string) => {
    if (!supabase || !confirm('Are you sure you want to delete this license?')) return

    try {
      const { error } = await supabase
        .from('licenses')
        .delete()
        .eq('license_key', licenseKey)

      if (error) throw error
      loadData()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  if (!supabase) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          Missing Supabase configuration. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_SERVICE_KEY
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Notion Data - Admin Panel</h1>
        <button onClick={loadData} className={styles.refreshBtn}>
          Refresh
        </button>
      </div>

      <div className={styles.tabs}>
        <button
          className={activeTab === 'licenses' ? styles.activeTab : ''}
          onClick={() => setActiveTab('licenses')}
        >
          Licenses ({licenses.length})
        </button>
        <button
          className={activeTab === 'users' ? styles.activeTab : ''}
          onClick={() => setActiveTab('users')}
        >
          Users ({users.length})
        </button>
      </div>

      {activeTab === 'licenses' && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>License Keys</h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={styles.addBtn}
            >
              {showAddForm ? 'Cancel' : '+ Add License'}
            </button>
          </div>

          {showAddForm && (
            <div className={styles.form}>
              <input
                type="text"
                placeholder="License Key"
                value={newLicenseKey}
                onChange={(e) => setNewLicenseKey(e.target.value)}
                className={styles.input}
              />
              <input
                type="text"
                placeholder="Notes (optional)"
                value={newLicenseNotes}
                onChange={(e) => setNewLicenseNotes(e.target.value)}
                className={styles.input}
              />
              <button onClick={addLicense} className={styles.submitBtn}>
                Add License
              </button>
            </div>
          )}

          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : (
            <div className={styles.table}>
              <table>
                <thead>
                  <tr>
                    <th>License Key</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.map((license) => (
                    <tr key={license.license_key}>
                      <td className={styles.licenseKey}>{license.license_key}</td>
                      <td>
                        <span
                          className={
                            license.status === 'active'
                              ? styles.statusActive
                              : styles.statusInactive
                          }
                        >
                          {license.status}
                        </span>
                      </td>
                      <td>{license.notes || '-'}</td>
                      <td>{new Date(license.created_at).toLocaleDateString()}</td>
                      <td>
                        <button
                          onClick={() =>
                            toggleLicenseStatus(license.license_key, license.status)
                          }
                          className={styles.toggleBtn}
                        >
                          {license.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => deleteLicense(license.license_key)}
                          className={styles.deleteBtn}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {licenses.length === 0 && (
                <div className={styles.empty}>No licenses found</div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className={styles.section}>
          <h2>Users</h2>
          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : (
            <div className={styles.table}>
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>License Key</th>
                    <th>Amazon Account ID</th>
                    <th>Notion Linked</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.email}</td>
                      <td className={styles.licenseKey}>{user.license_key}</td>
                      <td className={styles.accountId}>{user.amazon_account_id}</td>
                      <td>
                        <span className={styles.statusActive}>
                          {user.notion_token ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className={styles.empty}>No users found</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

