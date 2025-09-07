// src/components/DebugActiveOrg.tsx
import { useSelector } from 'react-redux';
import { selectActiveOrgId, selectActiveOrgName, selectActiveOrgStatus } from '../store/activeOrgSlice';

export default function DebugActiveOrg() {
  const activeOrgId = useSelector(selectActiveOrgId);
  const activeOrgName = useSelector(selectActiveOrgName);
  const activeOrgStatus = useSelector(selectActiveOrgStatus);
  const profileState = useSelector((state: any) => state.profile);
  const authState = useSelector((state: any) => state.auth);

  return (
    <div style={{ 
      position: 'fixed', 
      top: 10, 
      right: 10, 
      background: 'rgba(0,0,0,0.8)', 
      color: 'white', 
      padding: '10px',
      fontSize: '12px',
      maxWidth: '300px',
      zIndex: 9999,
      borderRadius: '4px'
    }}>
      {/* <h4>🐛 Debug Active Org</h4>
      <div><strong>Auth Status:</strong> {authState.status}</div>
      <div><strong>Auth User:</strong> {authState.user?.email || 'None'}</div>
      <hr style={{ margin: '8px 0' }} />
      <div><strong>Org Status:</strong> {activeOrgStatus}</div>
      <div><strong>Org ID:</strong> {activeOrgId || 'null'}</div>
      <div><strong>Org Name:</strong> {activeOrgName || 'null'}</div>
      <div style={{ fontSize: '10px', color: '#888' }}>
        {activeOrgId ? '✅ X-Org-Id will be sent' : '❌ X-Org-Id missing'}
      </div>
      <hr style={{ margin: '8px 0' }} />
      <div><strong>Profile Loaded:</strong> {profileState.loaded ? 'Yes' : 'No'}</div>
      <div><strong>Profile Loading:</strong> {profileState.loading ? 'Yes' : 'No'}</div>
      <div><strong>Profile Error:</strong> {profileState.error || 'None'}</div>
      <div><strong>Memberships:</strong> {profileState.data?.memberships?.length || 0}</div>
      {profileState.data?.memberships?.length > 0 && (
        <div style={{ fontSize: '10px', marginTop: '4px' }}>
          {profileState.data.memberships.map((m: any, i: number) => (
            <div key={i}>• {m.orgName} ({m.orgId})</div>
          ))}
        </div>
      )} */}
    </div>
  );
}
