import React from 'react'
import { connect } from 'react-redux'
import moment from 'moment'

import { editSign, deleteSign } from '../actions/signs'
import { setVisibilitySearchText, setVisibilityFilter } from '../actions/visibilityFilter'

import SignsList from '../components/SignsList'

import { getFeedsForPermission } from '../util/util'

const getVisibleSigns = (signs, visibilityFilter) => {
  if (!signs) return []
  let visibleSigns = signs.filter(sign =>
    sign.title.toLowerCase().indexOf((visibilityFilter.searchText || '').toLowerCase()) !== -1)
  let now = moment()
  switch (visibilityFilter.filter) {
    case 'ALL':
      return visibleSigns
    case 'ACTIVE':
      return visibleSigns.filter(sign =>
        moment(sign.start).isBefore(now) && moment(sign.end).isAfter(now))
    case 'FUTURE':
      return visibleSigns.filter(sign => moment(sign.start).isAfter(now))
    case 'ARCHIVED':
      return visibleSigns.filter(sign => moment(sign.end).isBefore(now))
    case 'DRAFT':
      return visibleSigns.filter(sign => !sign.published)
  }
  return visibleSigns
}

const mapStateToProps = (state, ownProps) => {
  console.log('all signs', state.signs.all)
  // if (state.projects.active !== null && state.projects.active.feeds !== null )
  return {
    isFetching: state.signs.isFetching,
    signs: getVisibleSigns(state.signs.all, state.visibilityFilter),
    visibilityFilter: state.visibilityFilter,
    editableFeeds: getFeedsForPermission(state.projects.active, state.user, 'edit-sign'),
    publishableFeeds: getFeedsForPermission(state.projects.active, state.user, 'approve-sign')
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  return {
    onEditClick: (sign) => dispatch(editSign(sign)),
    onDeleteClick: (sign) => dispatch(deleteSign(sign)),
    searchTextChanged: (text) => dispatch(setVisibilitySearchText(text)),
    visibilityFilterChanged: (filter) => dispatch(setVisibilityFilter(filter))
  }
}

const VisibleSignsList = connect(
  mapStateToProps,
  mapDispatchToProps
)(SignsList)

export default VisibleSignsList