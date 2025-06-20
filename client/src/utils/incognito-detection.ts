// Simple Incognito detection (works in most browsers)
export async function detectIncognito(): Promise<boolean> {
  const fs = (window as any).RequestFileSystem || (window as any).webkitRequestFileSystem;
  return new Promise(resolve => {
    if (!fs) return resolve(false);
    fs((window as any).TEMPORARY, 100, () => resolve(false), () => resolve(true));
  });
}

export function showIncognitoWarning() {
  const warningDiv = document.createElement('div');
  warningDiv.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #ff6b35;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 90%;
    text-align: center;
    animation: slideDown 0.3s ease-out;
  `;
  
  warningDiv.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <span>⚠️</span>
      <span>Heads up! In Incognito mode, CAPTCHA or sign-up may not work properly.</span>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        margin-left: 8px;
      ">×</button>
    </div>
  `;

  // Add animation keyframes
  if (!document.getElementById('incognito-warning-styles')) {
    const style = document.createElement('style');
    style.id = 'incognito-warning-styles';
    style.textContent = `
      @keyframes slideDown {
        from { transform: translateX(-50%) translateY(-100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(warningDiv);

  // Auto-remove after 8 seconds
  setTimeout(() => {
    if (warningDiv.parentElement) {
      warningDiv.remove();
    }
  }, 8000);
}