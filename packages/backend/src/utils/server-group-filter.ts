/**
 * Keep only regular (assignable) server groups from a raw `servergrouplist`
 * response. TS group types: 0 = template, 1 = regular, 2 = ServerQuery.
 * Template/query groups can never hold real members, and their names often
 * duplicate the regular ones (e.g. two "Server Admin"), which misleads group
 * pickers. Entries without a `type` field are kept (fail open).
 */
export function filterRegularServerGroups(list: unknown): any[] {
  return (Array.isArray(list) ? list : []).filter(
    (g: any) => g?.type === undefined || String(g.type) === '1',
  );
}
