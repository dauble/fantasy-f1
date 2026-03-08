// Setup utility for managing first-time user experience

const SETUP_COMPLETE_KEY = 'fantasy_f1_setup_complete';
const ONBOARDING_DISMISSED_KEY = 'fantasy_f1_onboarding_dismissed';

export const setupStorage = {
  // Check if initial setup is complete
  isSetupComplete() {
    try {
      const complete = localStorage.getItem(SETUP_COMPLETE_KEY);
      return complete === 'true';
    } catch (error) {
      console.error('Error checking setup status:', error);
      return false;
    }
  },

  // Mark setup as complete
  markSetupComplete() {
    try {
      localStorage.setItem(SETUP_COMPLETE_KEY, 'true');
      return true;
    } catch (error) {
      console.error('Error marking setup complete:', error);
      return false;
    }
  },

  // Reset setup (for testing or re-onboarding)
  resetSetup() {
    try {
      localStorage.removeItem(SETUP_COMPLETE_KEY);
      localStorage.removeItem(ONBOARDING_DISMISSED_KEY);
      return true;
    } catch (error) {
      console.error('Error resetting setup:', error);
      return false;
    }
  },

  // Check if user dismissed onboarding
  isOnboardingDismissed() {
    try {
      const dismissed = localStorage.getItem(ONBOARDING_DISMISSED_KEY);
      return dismissed === 'true';
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  },

  // Mark onboarding as dismissed (skip setup)
  dismissOnboarding() {
    try {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, 'true');
      localStorage.setItem(SETUP_COMPLETE_KEY, 'true');
      return true;
    } catch (error) {
      console.error('Error dismissing onboarding:', error);
      return false;
    }
  }
};

export default setupStorage;
