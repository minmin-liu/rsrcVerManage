import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Table, message } from 'antd';
import { LogoutOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../config/api';
import { getFullPath } from '../config/constants';
import '../styles/PcToolVersionListPage.css';
import { PcToolsShell } from '../components/PcToolsShell';

type Row = {
  key: string;
  name: string;
  url: string;
  note: string;
  forced: number;
  size: number;
  md5: string;
  ver: string;
  time: string;
};

const PcToolVersionListPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dataSource, setDataSource] = useState<Row[]>([]);
  const [pagination, setPagination] = useState<{ current: number; pageSize: number }>({
    current: 1,
    pageSize: 10,
  });

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    navigate(getFullPath('login'));
    message.success('已退出登录');
  };

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await axios.post(API.GET_PC_TOOL_FILE_LIST, {}, {});
      const { errCode, errMsg, data } = resp.data || {};
      if (errCode !== 0) {
        message.error(errMsg || '获取列表失败');
        setDataSource([]);
        return;
      }
      const files = data?.files || [];
      const rows: Row[] = files.map((f: any, idx: number) => ({
        key: String(f?.id ?? `${f?.name ?? 'row'}-${idx}`),
        name: f?.name ?? '-',
        url: f?.url ?? '',
        size: Number(f?.size ?? 0),
        md5: f?.md5 ?? '',
        ver: f?.ver ?? '',
        note: f?.note ?? '',
        forced: Number(f?.forced ?? 0),
        time: f?.time ?? '',
      }));
      setDataSource(rows);
    } catch (e) {
      console.error('获取PC工具列表失败:', e);
      message.error('获取列表失败，请稍后重试');
      setDataSource([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const columns = [
    { title: '文件名', dataIndex: 'name', key: 'name', width: 220, ellipsis: true },
    {
      title: '下载地址',
      dataIndex: 'url',
      key: 'url',
      width: 360,
      ellipsis: true,
      render: (v: string) => (v ? <a href={v} target="_blank" rel="noreferrer">{v}</a> : '-'),
    },
    { title: '大小(B)', dataIndex: 'size', key: 'size', width: 120 },
    { title: 'MD5', dataIndex: 'md5', key: 'md5', width: 220, ellipsis: true },
    { title: '版本号', dataIndex: 'ver', key: 'ver', width: 120 },
    { title: '强制', dataIndex: 'forced', key: 'forced', width: 80, render: (v: number) => (v ? '是' : '否') },
    { title: '更新说明', dataIndex: 'note', key: 'note', width: 260, ellipsis: true },
    { title: '创建时间', dataIndex: 'time', key: 'time', width: 180, ellipsis: true },
  ];

  return (
    <PcToolsShell
      active="list"
      headerRight={
        <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout} style={{ color: '#fff' }}>
          退出登录
        </Button>
      }
    >
      <div className="pcvml-content-inner">
        <Card
          className="pcvml-card"
          title="版本列表"
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(getFullPath('pc-tools/new'))}>
              新建
            </Button>
          }
        >
          <Table<Row>
            className="pcvml-table"
            columns={columns as any}
            dataSource={dataSource}
            rowKey="key"
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (total) => `共 ${total} 条`,
              onChange: (current, pageSize) => setPagination({ current, pageSize }),
              onShowSizeChange: (_current, pageSize) => setPagination({ current: 1, pageSize }),
            }}
            loading={loading}
            locale={{ emptyText: '暂无数据' }}
            tableLayout="fixed"
            // 固定高度：按10条可视高度，少于10条也保持一致；20+条通过滚动查看
            scroll={{ x: 1400, y: 52 * 10 }}
          />
        </Card>
      </div>
    </PcToolsShell>
  );
};

export default PcToolVersionListPage;

