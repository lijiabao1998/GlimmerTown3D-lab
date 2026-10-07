// D050: the error belongs to one submitted field value, not to later edits.
// Clearing means unchecked; this view never decodes, normalizes or saves a code.
export function createImportFeedback(field: HTMLTextAreaElement, error: HTMLElement) {
  let active = false, rejectedValue: string | null = null;
  const clear = () => {
    rejectedValue = null; error.textContent = ''; field.removeAttribute('aria-invalid');
  };
  field.addEventListener('input', () => {
    if (active && rejectedValue !== null && field.value !== rejectedValue) clear();
  });
  return {
    clear,
    reset(open: boolean) { active = open; clear(); },
    show(message: string) {
      if (!active) return;
      rejectedValue = field.value; error.textContent = message; field.setAttribute('aria-invalid', 'true');
    },
  };
}
