import React from 'react';
import { Layout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { getFullPath } from '../config/constants';

const { Sider, Content, Header } = Layout;
const { Title } = Typography;

type Props = {
  active: 'list' | 'manage';
  headerRight?: React.ReactNode;
  children: React.ReactNode;
};

export const PcToolsShell: React.FC<Props> = ({ active, headerRight, children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const onClick: MenuProps['onClick'] = (e) => {
    if (e.key === 'pc-tools/manage') navigate(getFullPath('pc-tools'));
  };

  const selectedKeys = ['pc-tools/manage'];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark">
        <div style={{ padding: '16px 16px 8px' }}>
          <Title level={5} style={{ color: '#fff', margin: 0 }}>
            资源版本管理系统
          </Title>
          <div style={{ color: 'rgba(255,255,255,0.65)', marginTop: 6, fontSize: 12 }}>{location.pathname}</div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          onClick={onClick}
          selectedKeys={selectedKeys}
          items={[
            {
              key: 'pc-tools/manage',
              label: 'PC工具版本管理',
            },
          ]}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: 'linear-gradient(90deg, #001529 0%, #06224d 60%, #0a2f63 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
          }}
        >
          <div style={{ color: 'rgba(255,255,255,0.85)' }}>{active === 'list' ? '版本列表' : '发布新版本'}</div>
          <div>{headerRight}</div>
        </Header>
        <Content style={{ padding: 24, background: '#f5f7fb' }}>{children}</Content>
      </Layout>
    </Layout>
  );
};

