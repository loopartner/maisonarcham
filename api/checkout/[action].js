// /api/checkout/<action> — délègue au routeur commun (api/_router.js).
import { dispatch } from '../_router.js';
export { dispatch as GET, dispatch as POST, dispatch as PUT, dispatch as PATCH, dispatch as DELETE };
