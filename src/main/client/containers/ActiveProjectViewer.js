import React from 'react'
import { connect } from 'react-redux'

import ProjectViewer from '../components/ProjectViewer'

import { setVisibilitySearchText } from '../actions/visibilityFilter'
import { fetchProject } from '../actions/projects'
import {
  fetchProjectFeeds,
  createFeedSource,
  saveFeedSource,
  updateFeedSource,
  deleteFeedSource
} from '../actions/feeds'

const mapStateToProps = (state, ownProps) => {
  return {
    project: state.projects.all
      ? state.projects.all.find(p => p.id === ownProps.routeParams.projectId)
      : null,
    visibilitySearchText: state.visibilityFilter.searchText
  }
}

const mapDispatchToProps = (dispatch, ownProps) => {
  const projectId = ownProps.routeParams.projectId
  return {
    onComponentMount: (initialProps) => {
      dispatch(setVisibilitySearchText(null))
      if (!initialProps.project) dispatch(fetchProject(projectId))
      else if (!initialProps.project.feedSources) dispatch(fetchProjectFeeds(projectId))
    },
    onNewFeedSourceClick: () => { dispatch(createFeedSource(projectId)) },
    newFeedSourceNamed: (name) => {
      dispatch(saveFeedSource({ projectId, name }))
    },
    feedSourcePropertyChanged: (feedSource, propName, newValue) => {
      dispatch(updateFeedSource(feedSource, { [propName] : newValue }))
    },
    searchTextChanged: (text) => { dispatch(setVisibilitySearchText(text))},
    deleteFeedSourceConfirmed: (feedSource) => {
      dispatch(deleteFeedSource(feedSource))
    }
  }
}

const ActiveProjectViewer = connect(
  mapStateToProps,
  mapDispatchToProps
)(ProjectViewer)

export default ActiveProjectViewer