import { useState } from 'react';
import { useTenantContext } from '@/context/TenantContext';
import { ChevronDown, Building2, Check } from 'lucide-react';

interface TenantSelectorProps {
  variant?: 'dropdown' | 'modal' | 'compact';
  className?: string;
}

export function TenantSelector({ variant = 'dropdown', className = '' }: TenantSelectorProps) {
  const { currentTenant, availableTenants, switchTenant, isLoading } = useTenantContext();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading) {
    return (
      <div className={`animate-pulse bg-gray-200 rounded-md h-10 w-40 ${className}`} />
    );
  }

  // Don't show selector if only one tenant
  if (availableTenants.length <= 1) {
    if (!currentTenant) return null;
    
    return (
      <div className={`flex items-center gap-2 px-3 py-2 text-sm ${className}`}>
        <Building2 className="w-4 h-4 text-gray-500" />
        <span className="font-medium">{currentTenant.name}</span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          <span className="max-w-[100px] truncate">{currentTenant?.slug || 'Select'}</span>
          <ChevronDown className="w-3 h-3" />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 mt-1 bg-white rounded-md shadow-lg border z-50 min-w-[150px]">
              {availableTenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => {
                    switchTenant(tenant.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 flex items-center gap-2 ${
                    currentTenant?.id === tenant.id ? 'bg-blue-50 text-blue-700' : ''
                  }`}
                >
                  {currentTenant?.id === tenant.id && <Check className="w-3 h-3" />}
                  <span className={currentTenant?.id === tenant.id ? '' : 'ml-5'}>{tenant.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Default dropdown variant
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors min-w-[200px]"
      >
        <Building2 className="w-4 h-4 text-gray-500" />
        <span className="flex-1 text-left text-sm font-medium truncate">
          {currentTenant?.name || 'Select Organization'}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border z-50 py-1 max-h-[300px] overflow-y-auto">
            {availableTenants.map((tenant) => (
              <button
                key={tenant.id}
                onClick={() => {
                  switchTenant(tenant.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-3 ${
                  currentTenant?.id === tenant.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="w-8 h-8 bg-gray-200 rounded-md flex items-center justify-center">
                  {tenant.logo ? (
                    <img src={tenant.logo} alt="" className="w-6 h-6 object-contain" />
                  ) : (
                    <Building2 className="w-4 h-4 text-gray-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{tenant.name}</div>
                  <div className="text-xs text-gray-500">{tenant.slug}</div>
                </div>
                {currentTenant?.id === tenant.id && (
                  <Check className="w-4 h-4 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Full-page tenant selector for when no tenant is selected
export function TenantSelectorPage() {
  const { availableTenants, switchTenant, isLoading } = useTenantContext();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Building2 className="w-12 h-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Select Organization</h1>
          <p className="text-gray-600 mt-2">Choose an organization to continue</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg border p-2 space-y-1">
          {availableTenants.map((tenant) => (
            <button
              key={tenant.id}
              onClick={() => switchTenant(tenant.id)}
              className="w-full text-left p-4 hover:bg-gray-50 rounded-lg flex items-center gap-4 transition-colors"
            >
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                {tenant.logo ? (
                  <img src={tenant.logo} alt="" className="w-8 h-8 object-contain" />
                ) : (
                  <Building2 className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{tenant.name}</div>
                <div className="text-sm text-gray-500">{tenant.slug}</div>
              </div>
            </button>
          ))}
        </div>

        {availableTenants.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p>No organizations available.</p>
            <p className="text-sm mt-2">Contact your administrator.</p>
          </div>
        )}
      </div>
    </div>
  );
}
