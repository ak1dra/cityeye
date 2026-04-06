import { NextResponse } from 'next/server';
import {
  updateReport,
} from '../../../../lib/server/reportRepository.js';
import {
  assertManagedRole,
  requireAuthenticatedRequest,
} from '../../../../lib/server/requestAuth.js';
import { validatePatchReportPayload } from '../../../../lib/server/reportValidation.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  let auth;

  try {
    auth = await requireAuthenticatedRequest(request);
    assertManagedRole(auth);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Authentication required' },
      { status: error.statusCode || 401 }
    );
  }

  const payload = await request.json().catch(() => ({}));
  try {
    validatePatchReportPayload(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: error.statusCode || 400 }
    );
  }

  try {
    const updated = await updateReport(params.id, payload, { authToken: auth.token });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || 'Failed to save reports' },
      { status: error.statusCode || 500 }
    );
  }
}
