export function providerStatusesResponse(overrides?: Partial<Record<"aws" | "oci", boolean>>) {
  const enabled = { aws: true, oci: true, ...overrides };
  return [
    {
      provider: "aws",
      enabled: enabled.aws,
      configured: true,
      last_validated_at: null,
      last_validation_status: null,
      last_validation_error: null,
    },
    {
      provider: "oci",
      enabled: enabled.oci,
      configured: true,
      last_validated_at: null,
      last_validation_status: null,
      last_validation_error: null,
    },
  ];
}
