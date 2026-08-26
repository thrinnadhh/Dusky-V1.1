import { ACTIVE_FOUNDATION_CONTRACTS } from '@dusky/contracts';

export default function Page(): React.JSX.Element {
  return (
    <main>
      <h1>Dusky Admin</h1>
      <p>{ACTIVE_FOUNDATION_CONTRACTS.admin.contractId}</p>
    </main>
  );
}

