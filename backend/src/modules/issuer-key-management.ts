configureIssuerKeyManagement({
  network: "testnet",
  apiBaseUrl: "/api",
  allowCustodialSigning: true,
  getAuthenticatedIssuer: async () => {
    // Replace with your authenticated user/session lookup.
    return await getCurrentIssuer();
  },
  buildTransaction: async (request, issuerPublicKey) => {
    // Replace with your existing Soroban contract integration.
    return await buildCredentialTransaction({
      operation: request.operation,
      credentialId: request.credentialId,
      issuerPublicKey,
      metadata: request.metadata,
    });
  },
});

// Connect Freighter:
const publicKey = await connectFreighter();

// Issue:
const result = await issueCredential(
  currentIssuer.id,
  credential.id,
);

// Revoke:
const revoked = await revokeCredential(
  currentIssuer.id,
  credential.id,
);
