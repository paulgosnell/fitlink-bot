# Schema Validation Tools

## Quick Usage

### Full Schema Validation
```bash
./scripts/validate-schema.sh
```
- Analyzes migration files for table schemas
- Checks TypeScript interfaces 
- Validates OAuth functions for schema mismatches
- Detects type conversion issues
- Identifies common antipatterns

### Quick Schema Check  
```bash
./scripts/quick-schema-check.sh
```
- Fast validation of critical tables
- Checks field naming conventions
- Validates sleep data field usage
- Identifies common problems

## When to Run

### Before Deployment
```bash
# Run validation before any database changes
./scripts/validate-schema.sh
```

### After Schema Changes
```bash
# Check for issues after modifying migrations
./scripts/quick-schema-check.sh
```

### Regular Maintenance
Add to your development workflow:
```bash
# Add to package.json scripts or Git hooks
"scripts": {
  "validate-schema": "./scripts/validate-schema.sh",
  "check-schema": "./scripts/quick-schema-check.sh"
}
```

## Common Issues Detected

### ✅ **Resolved Issues**
- ~~Sleep duration field mismatches~~ 
- ~~Column name inconsistencies~~
- ~~Type conversion errors~~

### ⚠️ **Current Warnings**
- `select('*')` usage (30 instances) - consider explicit columns
- Hardcoded table names (72 instances) - consider constants

### 🔍 **Monitoring For**
- UUID/bigint type confusion
- Field naming inconsistencies  
- Missing table definitions
- Type conversion patterns

## Schema Naming Conventions

### Sleep Data Fields
```typescript
// ✅ Correct: Database fields use '_minutes'
{
  total_sleep_minutes: sleep.total_sleep_duration / 60,
  deep_sleep_minutes: sleep.deep_sleep_duration / 60,
  light_sleep_minutes: sleep.light_sleep_duration / 60,
  rem_sleep_minutes: sleep.rem_sleep_duration / 60
}

// ❌ Wrong: Using API field names in database
{
  total_sleep_duration: sleep.total_sleep_duration,  // NO
  deep_sleep_duration: sleep.deep_sleep_duration     // NO
}
```

### Type Conversions
```typescript
// ✅ Correct: Seconds to minutes with rounding
Math.round(seconds / 60)

// ❌ Wrong: Seconds to hours
seconds / 3600
```

## Live Database Testing

Test actual database schema:
```bash
curl https://fitlinkbot.netlify.app/test-schema/
```

## Integration with Development

Add schema validation to your workflow:

### Git Pre-commit Hook
```bash
#!/bin/sh
# .git/hooks/pre-commit
./scripts/quick-schema-check.sh
```

### CI/CD Pipeline
```yaml
# GitHub Actions
- name: Validate Schema
  run: ./scripts/validate-schema.sh
```

### VS Code Tasks
```json
{
  "label": "Validate Schema",
  "type": "shell", 
  "command": "./scripts/validate-schema.sh",
  "group": "test"
}
```
