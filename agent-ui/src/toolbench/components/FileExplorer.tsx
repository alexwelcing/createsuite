import React, { useState, useMemo } from 'react';
import styled from 'styled-components';
import { Folder, FolderOpen, File, ChevronRight, ChevronDown, Search, FileText, Code, Image, FileJson } from 'lucide-react';
import type { FileNode } from '../types';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #c0c0c0;
`;

const Toolbar = styled.div`
  padding: 8px;
  border-bottom: 2px solid;
  border-color: #808080 #ffffff #ffffff #808080;
  display: flex;
  gap: 8px;
  align-items: center;
`;

const SearchInput = styled.input`
  flex: 1;
  padding: 4px 8px;
  border: 2px solid;
  border-color: #404040 #ffffff #ffffff #404040;
  background: #ffffff;
  font-family: inherit;
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: #000080;
  }
`;

const FileTree = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 8px;
`;

const TreeItem = styled.div`
  display: flex;
  flex-direction: column;
`;

const TreeRow = styled.div<{ $depth: number; $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
  padding-left: ${props => props.$depth * 16}px;
  background: ${props => props.$selected ? '#000080' : 'transparent'};
  color: ${props => props.$selected ? '#ffffff' : '#000000'};
  cursor: pointer;
  font-size: 12px;

  &:hover {
    background: ${props => props.$selected ? '#000080' : '#e0e0e0'};
  }
`;

const ItemIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
`;

const ItemName = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 12px;
`;

const Breadcrumb = styled.div`
  padding: 6px 8px;
  background: #d4d4d4;
  border-bottom: 1px solid #808080;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
`;

const BreadcrumbItem = styled.span`
  color: #000080;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }

  &:last-child {
    color: #000000;
    cursor: default;
    text-decoration: none;
  }
`;

const FILE_ICONS: Record<string, React.ReactNode> = {
  tsx: <Code size={14} color="#3178c6" />,
  ts: <Code size={14} color="#3178c6" />,
  jsx: <Code size={14} color="#f7df1e" />,
  js: <Code size={14} color="#f7df1e" />,
  json: <FileJson size={14} color="#cbcb41" />,
  md: <FileText size={14} />,
  txt: <FileText size={14} />,
  png: <Image size={14} color="#e34c26" />,
  jpg: <Image size={14} color="#e34c26" />,
  svg: <Image size={14} color="#e34c26" />,
  default: <File size={14} />,
};

interface FileExplorerProps {
  rootPath?: string;
  onSelectFile?: (path: string, node: FileNode) => void;
}

const buildFileTree = (rootPath: string = '/'): FileNode[] => {
  return [
    {
      id: 'src',
      name: 'src',
      path: `${rootPath}src`,
      type: 'directory',
      expanded: true,
      children: [
        {
          id: 'src-components',
          name: 'components',
          path: `${rootPath}src/components`,
          type: 'directory',
          expanded: true,
          children: [
            { id: 'src-components-App.tsx', name: 'App.tsx', path: `${rootPath}src/components/App.tsx`, type: 'file' },
            { id: 'src-components-Terminal.tsx', name: 'Terminal.tsx', path: `${rootPath}src/components/Terminal.tsx`, type: 'file' },
            { id: 'src-components-Button.tsx', name: 'Button.tsx', path: `${rootPath}src/components/Button.tsx`, type: 'file' },
          ],
        },
        {
          id: 'src-toolbench',
          name: 'toolbench',
          path: `${rootPath}src/toolbench`,
          type: 'directory',
          expanded: false,
          children: [
            { id: 'src-toolbench-Toolbench.tsx', name: 'Toolbench.tsx', path: `${rootPath}src/toolbench/Toolbench.tsx`, type: 'file' },
            { id: 'src-toolbench-TaskBoard.tsx', name: 'TaskBoard.tsx', path: `${rootPath}src/toolbench/TaskBoard.tsx`, type: 'file' },
            { id: 'src-toolbench-types.ts', name: 'types.ts', path: `${rootPath}src/toolbench/types.ts`, type: 'file' },
          ],
        },
        { id: 'src-index.tsx', name: 'index.tsx', path: `${rootPath}src/index.tsx`, type: 'file' },
        { id: 'src-main.tsx', name: 'main.tsx', path: `${rootPath}src/main.tsx`, type: 'file' },
      ],
    },
    {
      id: 'public',
      name: 'public',
      path: `${rootPath}public`,
      type: 'directory',
      expanded: false,
      children: [
        { id: 'public-index.html', name: 'index.html', path: `${rootPath}public/index.html`, type: 'file' },
        { id: 'public-tour.mp4', name: 'tour.mp4', path: `${rootPath}public/tour.mp4`, type: 'file' },
      ],
    },
    { id: 'package.json', name: 'package.json', path: `${rootPath}package.json`, type: 'file' },
    { id: 'README.md', name: 'README.md', path: `${rootPath}README.md`, type: 'file' },
    { id: 'tsconfig.json', name: 'tsconfig.json', path: `${rootPath}tsconfig.json`, type: 'file' },
  ];
};

const getFileIcon = (filename: string): React.ReactNode => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || FILE_ICONS.default;
};

export const FileExplorer: React.FC<FileExplorerProps> = ({
  rootPath = '/',
  onSelectFile,
}) => {
  const [search, setSearch] = useState('');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([`${rootPath}src`, `${rootPath}src/components`]));
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [fileTree] = useState(() => buildFileTree(rootPath));

  const filteredTree = useMemo(() => {
    if (!search) return fileTree;

    const filterNode = (node: FileNode): FileNode | null => {
      const matches = node.name.toLowerCase().includes(search.toLowerCase());
      
      if (node.type === 'file') {
        return matches ? node : null;
      }

      const filteredChildren = (node.children || [])
        .map(filterNode)
        .filter((n): n is FileNode => n !== null);

      if (matches || filteredChildren.length > 0) {
        return {
          ...node,
          children: filteredChildren,
          expanded: true,
        };
      }
      return null;
    };

    return fileTree.map(filterNode).filter((n): n is FileNode => n !== null);
  }, [fileTree, search]);

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const handleSelect = (node: FileNode) => {
    if (node.type === 'file') {
      setSelectedPath(node.path);
      onSelectFile?.(node.path, node);
    }
  };

  const renderNode = (node: FileNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedPaths.has(node.path);
    const isSelected = selectedPath === node.path;

    if (node.type === 'directory') {
      return (
        <TreeItem key={node.id}>
          <TreeRow
            $depth={depth}
            $selected={isSelected}
            onClick={() => {
              toggleExpand(node.path);
              handleSelect(node);
            }}
          >
            <ItemIcon>
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </ItemIcon>
            <ItemIcon>
              {isExpanded ? <FolderOpen size={14} color="#ffa500" /> : <Folder size={14} color="#ffa500" />}
            </ItemIcon>
            <ItemName>{node.name}</ItemName>
          </TreeRow>
          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderNode(child, depth + 1))}
            </div>
          )}
        </TreeItem>
      );
    }

    return (
      <TreeRow
        key={node.id}
        $depth={depth}
        $selected={isSelected}
        onClick={() => handleSelect(node)}
      >
        <ItemIcon style={{ width: '20px' }} />
        <ItemIcon>{getFileIcon(node.name)}</ItemIcon>
        <ItemName>{node.name}</ItemName>
      </TreeRow>
    );
  };

  const pathParts = selectedPath?.split('/').filter(Boolean) || [];
  const displayPath = pathParts.length > 0 
    ? ['root', ...pathParts]
    : ['root'];

  return (
    <Container>
      <Toolbar>
        <Search 
          size={14} 
          style={{ color: '#666', flexShrink: 0 }} 
        />
        <SearchInput
          placeholder="Search files..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        />
      </Toolbar>
      {selectedPath && (
        <Breadcrumb>
          {displayPath.map((part, i) => (
            <React.Fragment key={i}>
              <BreadcrumbItem>{part}</BreadcrumbItem>
              {i < displayPath.length - 1 && <span>/</span>}
            </React.Fragment>
          ))}
        </Breadcrumb>
      )}
      <FileTree>
        {filteredTree.length === 0 ? (
          <EmptyState>No files found</EmptyState>
        ) : (
          filteredTree.map(node => renderNode(node))
        )}
      </FileTree>
    </Container>
  );
};

export default FileExplorer;
