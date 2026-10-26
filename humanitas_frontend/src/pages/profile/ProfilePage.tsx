import { AccountSettings } from '@/components/settings/AccountSettings';
import { PageHeader } from '@/components/design-system/PageHeader';

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-8">
      <PageHeader
        title="My Profile"
        description="Manage your personal details, credentials, documents, and digital signature."
      />
      <div className="max-w-4xl">
        <AccountSettings />
      </div>
    </div>
  );
}
