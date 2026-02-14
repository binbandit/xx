export function inlineSourceMap(
  code: string,
  map: object,
): string {
  const mapJson = JSON.stringify(map);
  const mapBase64 = Buffer.from(mapJson).toString('base64');
  const sourceMapComment = `\n//# sourceMappingURL=data:application/json;base64,${mapBase64}\n`;
  return code + sourceMapComment;
}
