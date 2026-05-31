it(
  'shows success toast after issuance',
  async () => {
    render(
      <IssueCertificate />,
    );

    await user.click(
      screen.getByText(
        /confirm/i,
      ),
    );

    expect(
      toast.success,
    ).toHaveBeenCalledWith(
      expect.stringContaining(
        'Certificate issued successfully',
      ),
    );
  },
);