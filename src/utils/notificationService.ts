/**
 * Notification Service for Browser Notifications and Audio Alerts
 * Supports both desktop and mobile browsers (Chrome, Edge, Firefox, Android browsers).
 */

class NotificationService {
  private audioCtx: AudioContext | null = null

  /**
   * Checks if the Notification API is supported in the current environment
   */
  public isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window
  }

  /**
   * Gets current permission status
   */
  public getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied'
    return Notification.permission
  }

  /**
   * Requests permission to show browser notifications
   */
  public async requestPermission(): Promise<boolean> {
    if (!this.isSupported()) return false
    try {
      const perm = await Notification.requestPermission()
      return perm === 'granted'
    } catch (err) {
      console.warn('Error requesting notification permission:', err)
      return false
    }
  }

  /**
   * Plays a pleasant 2-tone chime using Web Audio API synthesis (no audio files needed)
   */
  public playChime() {
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return

      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioContextClass()
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume()
      }

      const now = this.audioCtx.currentTime

      // Tone 1: 587.33 Hz (D5)
      const osc1 = this.audioCtx.createOscillator()
      const gain1 = this.audioCtx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(587.33, now)
      gain1.gain.setValueAtTime(0.15, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
      osc1.connect(gain1)
      gain1.connect(this.audioCtx.destination)
      osc1.start(now)
      osc1.stop(now + 0.35)

      // Tone 2: 880 Hz (A5)
      const osc2 = this.audioCtx.createOscillator()
      const gain2 = this.audioCtx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(880, now + 0.12)
      gain2.gain.setValueAtTime(0.18, now + 0.12)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6)
      osc2.connect(gain2)
      gain2.connect(this.audioCtx.destination)
      osc2.start(now + 0.12)
      osc2.stop(now + 0.6)
    } catch {
      // Ignore audio synthesis errors if user hasn't interacted with page yet
    }
  }

  /**
   * Sends a browser/system notification on mobile and desktop
   */
  public sendNotification(title: string, options?: { body?: string; tag?: string; icon?: string }) {
    // 1. Always play the notification sound
    this.playChime()

    // 2. If permitted, dispatch real browser/system notification
    if (this.isSupported() && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body: options?.body,
          tag: options?.tag,
          icon: options?.icon || '/favicon.ico',
          badge: '/favicon.ico',
        })
        notif.onclick = () => {
          window.focus()
          notif.close()
        }
      } catch (err) {
        console.warn('Could not display browser notification:', err)
      }
    }
  }
}

export const notificationService = new NotificationService()

