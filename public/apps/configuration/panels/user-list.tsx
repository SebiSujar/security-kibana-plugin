/*
 *   Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *
 *   Licensed under the Apache License, Version 2.0 (the "License").
 *   You may not use this file except in compliance with the License.
 *   A copy of the License is located at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   or in the "license" file accompanying this file. This file is distributed
 *   on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
 *   express or implied. See the License for the specific language governing
 *   permissions and limitations under the License.
 */

import {
  EuiBadge,
  EuiButton,
  EuiButtonEmpty,
  EuiFlexGroup,
  EuiFlexItem,
  EuiInMemoryTable,
  EuiLink,
  EuiPageBody,
  EuiPageContent,
  EuiPageContentHeader,
  EuiPageContentHeaderSection,
  EuiPageHeader,
  EuiText,
  EuiTitle,
  Query,
} from '@elastic/eui';
import { Dictionary, difference, isEmpty, map } from 'lodash';
import React, { useState } from 'react';
import { getAuthInfo } from '../../../utils/auth-info-utils';
import { AppDependencies } from '../../types';
import { API_ENDPOINT_INTERNALUSERS, DocLinks } from '../constants';
import { Action, ResourceType } from '../types';
import { EMPTY_FIELD_VALUE } from '../ui-constants';
import { useContextMenuState } from '../utils/context-menu';
import { useDeleteConfirmState } from '../utils/delete-confirm-modal-utils';
import { ExternalLink, tableItemsUIProps } from '../utils/display-utils';
import {
  getUserList,
  InternalUsersListing,
  requestDeleteUsers,
} from '../utils/internal-user-list-utils';
import { showTableStatusMessage } from '../utils/loading-spinner-utils';
import { buildHashUrl } from '../utils/url-builder';

export function dictView(items: Dictionary<string>) {
  if (isEmpty(items)) {
    return EMPTY_FIELD_VALUE;
  }
  return (
    <EuiFlexGroup direction="column" style={{ margin: '1px' }}>
      {map(items, (v, k) => (
        <EuiText key={k} className={tableItemsUIProps.cssClassName}>
          {k}: {`"${v}"`}
        </EuiText>
      ))}
    </EuiFlexGroup>
  );
}

export function getColumns(currentUsername: string) {
  return [
    {
      field: 'username',
      name: 'Username',
      render: (username: string) => (
        <>
          <a href={buildHashUrl(ResourceType.users, Action.edit, username)}>{username}</a>
          {username === currentUsername && (
            <>
              &nbsp;
              <EuiBadge>Current</EuiBadge>
            </>
          )}
        </>
      ),
      sortable: true,
    },
    {
      field: 'attributes',
      name: 'Attributes',
      render: dictView,
      truncateText: true,
    },
  ];
}

export function UserList(props: AppDependencies) {
  const [userData, setUserData] = React.useState<InternalUsersListing[]>([]);
  const [errorFlag, setErrorFlag] = React.useState(false);
  const [selection, setSelection] = React.useState<InternalUsersListing[]>([]);
  const [currentUsername, setCurrentUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<Query | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const userDataPromise = getUserList(props.coreStart.http);
        setCurrentUsername((await getAuthInfo(props.coreStart.http)).user_name);
        setUserData(await userDataPromise);
      } catch (e) {
        console.log(e);
        setErrorFlag(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [props.coreStart.http]);

  const handleDelete = async () => {
    const usersToDelete: string[] = selection.map((r) => r.username);
    try {
      await requestDeleteUsers(props.coreStart.http, usersToDelete);
      // Refresh from server (calling fetchData) does not work here, the server still return the users
      // that had been just deleted, probably because ES takes some time to sync to all nodes.
      // So here remove the selected users from local memory directly.
      setUserData(difference(userData, selection));
      setSelection([]);
    } catch (e) {
      console.log(e);
    } finally {
      closeActionsMenu();
    }
  };

  const [showDeleteConfirmModal, deleteConfirmModal] = useDeleteConfirmState(
    handleDelete,
    'user(s)'
  );

  const actionsMenuItems = [
    <EuiButtonEmpty
      data-test-subj="edit"
      key="edit"
      onClick={() => {
        window.location.href = buildHashUrl(ResourceType.users, Action.edit, selection[0].username);
      }}
      disabled={selection.length !== 1}
    >
      Edit
    </EuiButtonEmpty>,
    <EuiButtonEmpty
      data-test-subj="duplicate"
      key="duplicate"
      onClick={() => {
        window.location.href = buildHashUrl(
          ResourceType.users,
          Action.duplicate,
          selection[0].username
        );
      }}
      disabled={selection.length !== 1}
    >
      Duplicate
    </EuiButtonEmpty>,
    <EuiButtonEmpty
      key="export"
      disabled={selection.length !== 1}
      href={
        selection.length === 1
          ? `${props.coreStart.http.basePath.serverBasePath}${API_ENDPOINT_INTERNALUSERS}/${selection[0].username}`
          : ''
      }
      target="_blank"
    >
      Export JSON
    </EuiButtonEmpty>,
    <EuiButtonEmpty
      key="delete"
      color="danger"
      onClick={showDeleteConfirmModal}
      disabled={selection.length === 0 || selection.some((e) => e.username === currentUsername)}
    >
      Delete
    </EuiButtonEmpty>,
  ];

  const [actionsMenu, closeActionsMenu] = useContextMenuState('Actions', {}, actionsMenuItems);

  return (
    <>
      <EuiPageHeader>
        <EuiTitle size="l">
          <h1>Internal users</h1>
        </EuiTitle>
      </EuiPageHeader>
      <EuiPageContent>
        <EuiPageContentHeader>
          <EuiPageContentHeaderSection>
            <EuiTitle size="s">
              <h3>
                Internal users
                <span className="panel-header-count">
                  {' '}
                  ({Query.execute(query || '', userData).length})
                </span>
              </h3>
            </EuiTitle>
            <EuiText size="xs" color="subdued">
              The Security plugin includes an internal user database. Use this database in place of,
              or in addition to, an external authentication system such as LDAP server or Active
              Directory. You can map an internal user to a role from{' '}
              <EuiLink href={buildHashUrl(ResourceType.roles)}>Roles</EuiLink>
              . First, click into the detail page of the role. Then, under “Mapped users”, click
              “Manage mapping” <ExternalLink href={DocLinks.MapUsersToRolesDoc} />
            </EuiText>
          </EuiPageContentHeaderSection>
          <EuiPageContentHeaderSection>
            <EuiFlexGroup>
              <EuiFlexItem>{actionsMenu}</EuiFlexItem>
              <EuiFlexItem>
                <EuiButton fill href={buildHashUrl(ResourceType.users, Action.create)}>
                  Create internal user
                </EuiButton>
              </EuiFlexItem>
            </EuiFlexGroup>
          </EuiPageContentHeaderSection>
        </EuiPageContentHeader>
        <EuiPageBody>
          <EuiInMemoryTable
            tableLayout={'auto'}
            loading={userData === [] && !errorFlag}
            columns={getColumns(currentUsername)}
            // @ts-ignore
            items={userData}
            itemId={'username'}
            pagination
            search={{
              box: { placeholder: 'Search internal users' },
              onChange: (arg) => {
                setQuery(arg.query);
                return true;
              },
            }}
            // @ts-ignore
            selection={{ onSelectionChange: setSelection }}
            sorting
            error={errorFlag ? 'Load data failed, please check console log for more detail.' : ''}
            message={showTableStatusMessage(loading, userData)}
          />
        </EuiPageBody>
        {deleteConfirmModal}
      </EuiPageContent>
    </>
  );
}
