export function isLiterallyNumeric(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c < "0" || c > "9") {
      return false;
    }
  }

  return true;
}
