use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;
use std::fmt::{Display, Formatter};

pub const ADAPTER_NAME: &str = "rs-cup";
pub const ADAPTER_GENERATOR: &str = "rs-cup/0.2.4";
pub const PROTOCOL_VERSION: &str = "1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "type")]
pub enum ActionDescriptor {
    #[serde(rename = "fetch")]
    Fetch {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        method: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        payload: Option<Map<String, Value>>,
    },
    #[serde(rename = "emit")]
    Emit {
        event: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        detail: Option<Map<String, Value>>,
    },
    #[serde(rename = "navigate")]
    Navigate {
        url: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        replace: Option<bool>,
    },
}

pub fn fetch(url: impl Into<String>) -> ActionDescriptor {
    ActionDescriptor::Fetch {
        url: url.into(),
        method: Some("POST".to_string()),
        payload: None,
    }
}

pub fn emit(event: impl Into<String>) -> ActionDescriptor {
    ActionDescriptor::Emit {
        event: event.into(),
        detail: None,
    }
}

pub fn navigate(url: impl Into<String>) -> ActionDescriptor {
    ActionDescriptor::Navigate {
        url: url.into(),
        replace: None,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ViewMeta {
    pub version: String,
    pub lang: String,
    pub generator: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub route: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ProtocolView {
    pub template: String,
    #[serde(default)]
    pub state: Map<String, Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub actions: Option<BTreeMap<String, ActionDescriptor>>,
    pub meta: ViewMeta,
}

pub struct UIView {
    template: String,
    state: Map<String, Value>,
    actions: BTreeMap<String, ActionDescriptor>,
    title: Option<String>,
    route: Option<String>,
}

impl UIView {
    pub fn new(template: impl Into<String>) -> Self {
        Self {
            template: template.into(),
            state: Map::new(),
            actions: BTreeMap::new(),
            title: None,
            route: None,
        }
    }

    pub fn state_value(mut self, key: impl Into<String>, value: Value) -> Self {
        self.state.insert(key.into(), value);
        self
    }

    pub fn state_map(mut self, values: Map<String, Value>) -> Self {
        self.state.extend(values);
        self
    }

    pub fn action(mut self, name: impl Into<String>, action: ActionDescriptor) -> Self {
        self.actions.insert(name.into(), action);
        self
    }

    pub fn title(mut self, title: impl Into<String>) -> Self {
        self.title = Some(title.into());
        self
    }

    pub fn route(mut self, route: impl Into<String>) -> Self {
        self.route = Some(route.into());
        self
    }

    pub fn to_view(&self) -> ProtocolView {
        ProtocolView {
            template: self.template.clone(),
            state: self.state.clone(),
            actions: if self.actions.is_empty() {
                None
            } else {
                Some(self.actions.clone())
            },
            meta: ViewMeta {
                version: PROTOCOL_VERSION.to_string(),
                lang: "rust".to_string(),
                generator: ADAPTER_GENERATOR.to_string(),
                title: self.title.clone(),
                route: self.route.clone(),
            },
        }
    }

    pub fn to_json(&self) -> Result<String, ValidationError> {
        let view = self.to_view();
        validate_view(&view)?;
        serde_json::to_string(&view).map_err(|err| ValidationError::new(vec![format!("serialization failed: {err}")]))
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ValidationError {
    pub issues: Vec<String>,
}

impl ValidationError {
    fn new(issues: Vec<String>) -> Self {
        Self { issues }
    }
}

impl Display for ValidationError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "invalid CUP protocol view: {}", self.issues.join("; "))
    }
}

impl std::error::Error for ValidationError {}

#[derive(Debug, Clone, PartialEq)]
pub struct PolicyError {
    pub issues: Vec<String>,
}

impl Display for PolicyError {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        write!(f, "CUP view policy rejected: {}", self.issues.join("; "))
    }
}

impl std::error::Error for PolicyError {}

#[derive(Debug, Clone, PartialEq)]
pub enum ActionUrlPolicy {
    Any,
    RelativeOnly,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ViewPolicy {
    pub require_version: bool,
    pub require_title: bool,
    pub require_route: bool,
    pub allow_safe_filter: bool,
    pub allow_inline_handlers: bool,
    pub allow_javascript_urls: bool,
    pub allow_script_tags: bool,
    pub action_urls: ActionUrlPolicy,
}

impl Default for ViewPolicy {
    fn default() -> Self {
        Self {
            require_version: false,
            require_title: false,
            require_route: false,
            allow_safe_filter: true,
            allow_inline_handlers: true,
            allow_javascript_urls: true,
            allow_script_tags: true,
            action_urls: ActionUrlPolicy::Any,
        }
    }
}

pub fn starter_view_policy() -> ViewPolicy {
    ViewPolicy {
        require_version: true,
        require_title: true,
        require_route: true,
        allow_safe_filter: false,
        allow_inline_handlers: false,
        allow_javascript_urls: false,
        allow_script_tags: false,
        action_urls: ActionUrlPolicy::RelativeOnly,
    }
}

pub fn validate_view(view: &ProtocolView) -> Result<(), ValidationError> {
    let mut issues = Vec::new();

    if view.template.trim().is_empty() {
        issues.push("view.template must be a non-empty string".to_string());
    }

    if view.meta.version != PROTOCOL_VERSION {
        issues.push("view.meta.version must be \"1\"".to_string());
    }

    if let Some(actions) = &view.actions {
        for (name, action) in actions {
            match action {
                ActionDescriptor::Fetch { url, method, .. } => {
                    if url.trim().is_empty() {
                        issues.push(format!("view.actions.{name}.url must be a string"));
                    }
                    if let Some(method) = method {
                        if !matches!(method.as_str(), "GET" | "POST" | "PUT" | "PATCH" | "DELETE") {
                            issues.push(format!("view.actions.{name}.method must be one of GET, POST, PUT, PATCH, DELETE"));
                        }
                    }
                }
                ActionDescriptor::Emit { event, .. } => {
                    if event.trim().is_empty() {
                        issues.push(format!("view.actions.{name}.event must be a string"));
                    }
                }
                ActionDescriptor::Navigate { url, .. } => {
                    if url.trim().is_empty() {
                        issues.push(format!("view.actions.{name}.url must be a string"));
                    }
                }
            }
        }
    }

    if issues.is_empty() {
        Ok(())
    } else {
        Err(ValidationError::new(issues))
    }
}

pub fn validate_view_policy(view: &ProtocolView, policy: &ViewPolicy) -> Result<(), PolicyError> {
    validate_view(view).map_err(|err| PolicyError { issues: err.issues })?;

    let mut issues = Vec::new();
    let template = &view.template;

    if policy.require_version && view.meta.version != PROTOCOL_VERSION {
        issues.push("view.meta.version is required by policy".to_string());
    }
    if policy.require_title && view.meta.title.as_deref().unwrap_or("").is_empty() {
        issues.push("view.meta.title is required by policy".to_string());
    }
    if policy.require_route && view.meta.route.as_deref().unwrap_or("").is_empty() {
        issues.push("view.meta.route is required by policy".to_string());
    }
    if !policy.allow_safe_filter && template.contains("|safe") {
        issues.push("view.template uses the |safe filter, which is disabled by policy".to_string());
    }
    if !policy.allow_script_tags && template.to_lowercase().contains("<script") {
        issues.push("view.template contains a <script> tag, which is disabled by policy".to_string());
    }
    if !policy.allow_inline_handlers && template.to_lowercase().contains("onclick=") {
        issues.push("view.template contains inline event handler attributes, which are disabled by policy".to_string());
    }
    if !policy.allow_javascript_urls && template.to_lowercase().contains("javascript:") {
        issues.push("view.template contains a javascript: URL, which is disabled by policy".to_string());
    }

    if matches!(policy.action_urls, ActionUrlPolicy::RelativeOnly) {
        if let Some(actions) = &view.actions {
            for (name, action) in actions {
                match action {
                    ActionDescriptor::Fetch { url, .. } | ActionDescriptor::Navigate { url, .. } => {
                        if !is_relative_url(url) {
                            issues.push(format!("view.actions.{name}.url must stay relative under the current policy"));
                        }
                    }
                    ActionDescriptor::Emit { .. } => {}
                }
            }
        }
    }

    if issues.is_empty() {
        Ok(())
    } else {
        Err(PolicyError { issues })
    }
}

fn is_relative_url(url: &str) -> bool {
    url.starts_with('/')
        || url.starts_with("./")
        || url.starts_with("../")
        || url.starts_with('?')
        || url.starts_with('#')
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn it_builds_and_serializes_a_view() {
        let view = UIView::new("<h1>{{ title }}</h1>")
            .state_value("title", json!("Hello"))
            .action("reload", fetch("/api/reload"))
            .title("Home")
            .route("/")
            .to_view();

        validate_view(&view).unwrap();
        let json = serde_json::to_string(&view).unwrap();
        assert!(json.contains("\"generator\":\"rs-cup/0.2.4\""));
    }

    #[test]
    fn starter_policy_rejects_absolute_urls() {
        let view = UIView::new("<button data-action=\"save\">Save</button>")
            .action("save", fetch("https://example.com/save"))
            .title("Save")
            .route("/records/1")
            .to_view();

        let error = validate_view_policy(&view, &starter_view_policy()).unwrap_err();
        assert!(error.to_string().contains("must stay relative"));
    }
}
