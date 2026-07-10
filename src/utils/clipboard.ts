/**
 * 텍스트를 클립보드에 복사한다. navigator.clipboard가 없거나 실패하면
 * 숨긴 textarea + execCommand('copy') 레거시 경로로 폴백한다.
 * 성공 여부를 반환한다(복사 성공 UI 피드백용).
 */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // 레거시 경로로 폴백.
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', 'true');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const result = document.execCommand('copy');
    document.body.removeChild(textarea);
    return result;
  } catch {
    return false;
  }
}
