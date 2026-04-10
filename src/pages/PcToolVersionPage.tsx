import React, { useMemo, useRef, useState } from 'react';
import { Button, Card, Form, Input, message, Progress, Switch, Upload } from 'antd';
import { InboxOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API } from '../config/api';
import { getFullPath } from '../config/constants';
import { buildPcToolCosKey, createCosClient, getCosTmpSecretFgn } from '../utils/cos';
import { computeFileMd5 } from '../utils/hash';
import '../styles/PcToolVersionPage.css';
import { PcToolsShell } from '../components/PcToolsShell';

type FormValues = {
  version: string;
  updateNotes: string;
  forceUpdate: boolean;
  file: any[];
};

const containsChinese = (text: string) => /[\u3400-\u9FFF]/.test(text);

// 目标：文件名在浏览器/URL 展示时不出现需要转义的字符（如空格->%20）
// 仅允许 RFC3986 unreserved: ALPHA / DIGIT / "-" / "." / "_" / "~"
const isUrlSafeFileName = (name: string) => /^[A-Za-z0-9._~-]+$/.test(name);

const validatePcToolFileName = (plainName: string) => {
  if (containsChinese(plainName)) {
    return '文件名不能包含中文，请重命名后再上传';
  }
  if (!isUrlSafeFileName(plainName)) {
    return '文件名不能包含空格或特殊字符，仅允许字母、数字、点(.)、下划线(_)、中划线(-)、波浪线(~)';
  }
  return null;
};

const getPlainFileName = (name: string) => {
  const safe = name.replaceAll('\\', '/');
  const parts = safe.split('/');
  return parts[parts.length - 1] || name;
};

const PcToolVersionPage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const cosRef = useRef<any>(null);
  const taskIdRef = useRef<string | null>(null);
  const [form] = Form.useForm<FormValues>();

  const initialValues = useMemo<FormValues>(
    () => ({
      version: '',
      updateNotes: '',
      forceUpdate: false,
      file: [],
    }),
    []
  );

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    navigate(getFullPath('login'));
    message.success('已退出登录');
  };

  const handleBackToList = () => {
    // 返回列表：若正在上传，尽力取消任务
    try {
      const cos = cosRef.current;
      const taskId = taskIdRef.current;
      if (submitting && cos && taskId) {
        cos.cancelTask(taskId);
      }
    } catch {
      // ignore
    } finally {
      taskIdRef.current = null;
      cosRef.current = null;
      setSubmitting(false);
      setUploadPercent(0);
      navigate(getFullPath('pc-tools'));
    }
  };

  const beforeUpload = (file: File) => {
    const plainName = getPlainFileName(file.name);
    const err = validatePcToolFileName(plainName);
    if (err) {
      message.error(err);
      return Upload.LIST_IGNORE;
    }
    return false; // 阻止 antd 自动上传，交由表单提交时统一处理
  };

  const normFile = (e: any) => {
    if (Array.isArray(e)) return e;
    return e?.fileList ?? [];
  };

  const onFinish = async (values: FormValues) => {
    const fileItem = values.file?.[0];
    const fileObj: File | undefined = fileItem?.originFileObj;
    if (!fileObj) {
      message.error('请选择要上传的PC工具文件');
      return;
    }

    const plainName = getPlainFileName(fileObj.name);
    const nameErr = validatePcToolFileName(plainName);
    if (nameErr) {
      message.error(nameErr);
      return;
    }

    setSubmitting(true);
    setUploadPercent(0);
    try {
      const version = values.version.trim();
      const updateNotes = values.updateNotes.trim();
      const forceUpdate = !!values.forceUpdate;

      // 1) 获取临时密钥（拿到 bucket/region，同时注入 COS 客户端缓存，避免 SDK 立即二次拉取）
      const sts = await getCosTmpSecretFgn();
      const bucket = sts.bucket;
      const region = sts.region;

      // 2) 直传 COS（大文件通过 SliceSize 自动分块上传）
      const cos = createCosClient(sts);
      cosRef.current = cos;
      const key = buildPcToolCosKey(plainName, '');

      const putRes: any = await cos.uploadFile({
        Bucket: bucket,
        Region: region,
        Key: key,
        Body: fileObj,
        SliceSize: 1024 * 1024 * 5,
        ChunkSize: 1024 * 1024, // 每块 1MB（可按需调整）
        onTaskReady: (taskId: string) => {
          taskIdRef.current = taskId;
        },
        onProgress: (p: any) => {
          const percent = Math.floor(((p?.percent ?? 0) as number) * 100);
          setUploadPercent(percent);
        },
      });

      setUploadPercent(100);

      // 3) 计算MD5（用于后端校验）
      const md5 = await computeFileMd5(fileObj);

      // 4) 上传成功后，上报后端（取代旧 publish 接口）
      const resp = await axios.post(
        API.REPORT_PC_TOOL_FILE_INFO,
        {
          objectKey: key,
          size: fileObj.size,
          md5,
          ver: version,
          note: updateNotes,
          forced: forceUpdate ? 1 : 0
        },
        {}
      );

      const { errCode, errMsg } = resp.data || {};
      if (errCode === 0) {
        message.success('发布成功');
        form.resetFields();
        setUploadPercent(0);
        navigate(getFullPath('pc-tools'));
      } else {
        message.error(errMsg || '上报失败（已上传至COS）');
      }
    } catch (e) {
      console.error('发布PC工具失败:', e);
      message.error('发布失败，请稍后重试');
    } finally {
      taskIdRef.current = null;
      cosRef.current = null;
      setSubmitting(false);
    }
  };

  return (
    <PcToolsShell
      active="manage"
      headerRight={
        <>
          <Button type="text" onClick={handleBackToList} style={{ color: '#fff' }}>
            返回列表
          </Button>
          <Button type="text" icon={<LogoutOutlined />} onClick={handleLogout} style={{ color: '#fff' }}>
            退出登录
          </Button>
        </>
      }
    >
      <div className="pcvm-content-inner">
        <Card className="pcvm-card" title="发布新版本">
          {submitting ? (
            <div className="pcvm-progress">
              <div style={{ marginBottom: 8, color: 'rgba(0,0,0,0.65)' }}>上传进度</div>
              <Progress percent={uploadPercent} />
            </div>
          ) : null}
          <Form<FormValues>
            form={form}
            layout="vertical"
            initialValues={initialValues}
            onFinish={onFinish}
            requiredMark
          >
              <Form.Item
                label="PC工具文件"
                name="file"
                valuePropName="fileList"
                getValueFromEvent={normFile}
                rules={[
                  {
                    validator: async (_, fileList) => {
                      if (!fileList || fileList.length === 0) throw new Error('请选择文件');
                      if (fileList.length > 1) throw new Error('一次只能上传一个文件');
                      const f: File | undefined = fileList?.[0]?.originFileObj;
                      if (!f) throw new Error('文件不可用，请重新选择');
                      const plainName = getPlainFileName(f.name);
                      const err = validatePcToolFileName(plainName);
                      if (err) throw new Error(err);
                    },
                  },
                ]}
              >
                <Upload.Dragger
                  maxCount={1}
                  multiple={false}
                  beforeUpload={beforeUpload}
                  accept="*"
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">点击或拖拽文件到此处</p>
                  <p className="ant-upload-hint">每次发布上传一个PC工具文件</p>
                </Upload.Dragger>
              </Form.Item>

              <Form.Item
                label="版本号"
                name="version"
                rules={[
                  { required: true, message: '请输入版本号' },
                  { max: 64, message: '版本号过长' },
                ]}
              >
                <Input placeholder="例如：1.0.0" />
              </Form.Item>

              <Form.Item
                label="更新说明"
                name="updateNotes"
                rules={[
                  { required: true, message: '请输入更新说明' },
                  { max: 2000, message: '更新说明过长' },
                ]}
              >
                <Input.TextArea placeholder="请输入本次更新内容" autoSize={{ minRows: 4, maxRows: 10 }} />
              </Form.Item>

              <Form.Item label="是否强制更新" name="forceUpdate" valuePropName="checked">
                <Switch checkedChildren="强制" unCheckedChildren="非强制" />
              </Form.Item>

              <div className="pcvm-actions">
                <Button onClick={handleBackToList} disabled={false}>
                  返回列表
                </Button>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={submitting}
                >
                  发布
                </Button>
              </div>
          </Form>
        </Card>
      </div>
    </PcToolsShell>
  );
};

export default PcToolVersionPage;

